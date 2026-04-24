(function initAutoFillGraphV5Router(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;

  if (!Schema || !Utils) throw new Error("Load schema.js and utils.js before router.js");

  // ── LinUCB Bandit Router ───────────────────────────────────────────────────
  // Mirrors Prototype5 LinUCBRouter:
  //   CTX_DIM = 30  (labelEmb[:24] ++ domain_onehot[6])
  //   Arms    = ["local", "llm_small", "llm_large"]
  //   Policy  = ε-greedy (decay 0.35 → 0.05) + LinUCB UCB scores
  //   If hasLocal=false → force arm 1 (llm_small)

  const CTX_DIM = 30;
  const ARMS    = ["local", "llm_small", "llm_large"];
  const DOMAINS = ["job", "academic", "visa", "medical", "financial", "general"];

  class LinUCBArm {
    constructor(alpha = 0.5) {
      this.alpha = alpha;
      this.A = Utils.matrixIdentity(CTX_DIM);
      this.b = new Array(CTX_DIM).fill(0);
      this.pulls = 0;
    }

    ucb(ctx) {
      const Ainv_b = Utils.solveLinearSystem(this.A, this.b);
      const Ainv_x = Utils.solveLinearSystem(this.A, ctx);
      const mu = Utils.dot(Ainv_b, ctx);
      const var_ = Math.max(0, Utils.dot(ctx, Ainv_x));
      return mu + this.alpha * Math.sqrt(var_);
    }

    update(ctx, reward) {
      this.A = Utils.matrixAdd(this.A, Utils.outerProduct(ctx, ctx));
      this.b = Utils.vecAdd(this.b, Utils.vecScale(ctx, Number(reward)));
      this.pulls++;
    }

    serialize() {
      return { alpha: this.alpha, A: this.A, b: this.b, pulls: this.pulls };
    }

    static deserialize(data = {}) {
      const arm = new LinUCBArm(data.alpha ?? 0.5);
      if (data.A) arm.A = data.A;
      if (data.b) arm.b = data.b;
      arm.pulls = data.pulls || 0;
      return arm;
    }
  }

  class LinUCBRouter {
    constructor(options = {}) {
      this.arms        = ARMS;
      this.ctxDim      = CTX_DIM;
      this.epsilon     = Number(options.epsilon    ?? 0.35);
      this.epsilonDecay= Number(options.epsilonDecay ?? 0.97);
      this.minEpsilon  = Number(options.minEpsilon ?? 0.05);
      this._armModels  = [
        new LinUCBArm(0.5),
        new LinUCBArm(0.5),
        new LinUCBArm(0.5)
      ];
      this._decisions  = [];   // [{ctx, armIdx, label, forced, reward?}]
      this._rewardLog  = [];

      if (options.armModels) {
        this._armModels = options.armModels.map(d => LinUCBArm.deserialize(d));
      }
    }

    // Build 30-dim context: first 24 dims of label embedding + 6-dim domain one-hot
    _ctx(labelEmb, domain) {
      const domOH = DOMAINS.map(d => d === domain ? 1.0 : 0.0);
      return [...labelEmb.slice(0, 24), ...domOH];
    }

    // ── Select an arm ─────────────────────────────────────────────────────

    select(labelEmb, domain, hasLocal, label = null) {
      const ctx = this._ctx(labelEmb, domain);

      if (!hasLocal) {
        // Force LLM when no local evidence
        const entry = { ctx, armIdx: 1, label, forced: true };
        this._decisions.push(entry);
        return { armIdx: 1, armName: ARMS[1], ctx };
      }

      let armIdx;
      if (Math.random() < this.epsilon) {
        armIdx = Math.floor(Math.random() * 2);   // explore: 0 or 1
      } else {
        // Exploit: UCB across arms 0 and 1 (llm_large reserved for explicit calls)
        const scores = [0, 1].map(i => this._armModels[i].ucb(ctx));
        armIdx = scores[0] >= scores[1] ? 0 : 1;
      }
      const entry = { ctx, armIdx, label, forced: false };
      this._decisions.push(entry);
      return { armIdx, armName: ARMS[armIdx], ctx };
    }

    // ── Update bandit with reward ─────────────────────────────────────────

    updateForLabel(label, reward) {
      for (let i = this._decisions.length - 1; i >= 0; i--) {
        const d = this._decisions[i];
        if (d.label === label && d.reward === undefined) {
          this._applyReward(d, reward);
          return;
        }
      }
      this.update(reward);
    }

    update(reward) {
      for (let i = this._decisions.length - 1; i >= 0; i--) {
        const d = this._decisions[i];
        if (d.reward === undefined) { this._applyReward(d, reward); return; }
      }
    }

    _applyReward(d, reward) {
      this._armModels[d.armIdx].update(d.ctx, reward);
      this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
      this._rewardLog.push(reward);
      d.reward = reward;
    }

    rewardFromFeedback(action) {
      if (action === Schema.FeedbackAction.ACCEPT) return 1.0;
      if (action === Schema.FeedbackAction.CORRECT) return 0.2;
      return 0.0;
    }

    stats() {
      const rewards = this._rewardLog;
      const avg = rewards.length
        ? rewards.reduce((s, r) => s + r, 0) / rewards.length
        : 0;
      return {
        decisions: this._decisions.length,
        epsilon: Math.round(this.epsilon * 10000) / 10000,
        arm0_local: this._decisions.filter(d => d.armIdx === 0).length,
        arm1_llm: this._decisions.filter(d => d.armIdx === 1).length,
        arm2_llm_large: this._decisions.filter(d => d.armIdx === 2).length,
        avg_reward: Math.round(avg * 1000) / 1000
      };
    }

    serialize() {
      return {
        epsilon: this.epsilon, epsilonDecay: this.epsilonDecay,
        minEpsilon: this.minEpsilon,
        armModels: this._armModels.map(a => a.serialize())
      };
    }

    static deserialize(data = {}) { return new LinUCBRouter(data); }
  }

  const api = Object.freeze({ LinUCBRouter, LinUCBArm, CTX_DIM, ARMS });

  root.AutoFillGraphV5Router = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
