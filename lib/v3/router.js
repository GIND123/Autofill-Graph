(function initAutoFillGraphV3Router(root) {
  "use strict";

  const Schema = root.AutoFillGraphV3Schema;
  const Utils = root.AutoFillGraphV3Utils;

  if (!Schema || !Utils) {
    throw new Error("Load schema.js and utils.js before router.js");
  }

  class LinUCBRouter {
    constructor(options = {}) {
      this.arms = options.arms || [Schema.Route.LOCAL, Schema.Route.LLM_SMALL, Schema.Route.LLM_LARGE];
      this.dimension = Number(options.dimension || 390);
      this.alpha = Number(options.alpha ?? 0.8);
      this.epsilon = Number(options.epsilon ?? 0.35);
      this.epsilonDecay = Number(options.epsilonDecay ?? 0.97);
      this.minEpsilon = Number(options.minEpsilon ?? 0.05);
      this.models = {};

      for (const arm of this.arms) {
        this.models[arm] = {
          A: Utils.matrixIdentity(this.dimension),
          b: Array(this.dimension).fill(0),
          pulls: 0
        };
      }
    }

    select(contextVector, options = {}) {
      const availableArms = options.availableArms || this.arms;
      if (options.forceArm) return options.forceArm;
      if (Math.random() < this.epsilon) {
        return availableArms[Math.floor(Math.random() * availableArms.length)];
      }

      let best = null;
      for (const arm of availableArms) {
        const score = this.scoreArm(arm, contextVector);
        if (!best || score > best.score) best = { arm, score };
      }
      return best?.arm || availableArms[0];
    }

    scoreArm(arm, contextVector) {
      const model = this.models[arm];
      if (!model) return -Infinity;
      const theta = Utils.solveLinearSystem(model.A, model.b);
      const estimatedReward = Utils.dot(theta, contextVector);
      const solved = Utils.solveLinearSystem(model.A, contextVector);
      const uncertainty = Math.sqrt(Math.max(0, Utils.dot(contextVector, solved)));
      return estimatedReward + this.alpha * uncertainty;
    }

    update(arm, contextVector, reward) {
      if (!this.models[arm]) return;
      const model = this.models[arm];
      model.A = Utils.matrixAdd(model.A, Utils.outerProduct(contextVector, contextVector));
      model.b = Utils.vectorAdd(model.b, Utils.vectorScale(contextVector, Number(reward || 0)));
      model.pulls++;
      this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
    }

    rewardFromFeedback(action) {
      if (action === Schema.FeedbackAction.ACCEPT) return 1.0;
      if (action === Schema.FeedbackAction.CORRECT) return 0.2;
      return 0.0;
    }

    serialize() {
      return {
        arms: this.arms,
        dimension: this.dimension,
        alpha: this.alpha,
        epsilon: this.epsilon,
        epsilonDecay: this.epsilonDecay,
        minEpsilon: this.minEpsilon,
        models: this.models
      };
    }

    static deserialize(data = {}) {
      const router = new LinUCBRouter(data);
      if (data.models) router.models = data.models;
      return router;
    }
  }

  const api = Object.freeze({ LinUCBRouter });

  root.AutoFillGraphV3Router = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
