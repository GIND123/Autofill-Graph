(function initAutoFillGraphV5Memory(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;

  if (!Schema || !Utils) throw new Error("Load schema.js and utils.js before memory.js");

  // ── FillResult ────────────────────────────────────────────────────────────

  class FillResult {
    constructor(field, options = {}) {
      this.field      = field;
      this.prop       = options.prop ?? options.property ?? null;
      this.value      = options.value ?? null;
      this.status     = options.status || Schema.FillStatus.UNKNOWN;
      this.route      = options.route  || null;
      this.confidence = Number(options.confidence ?? 0);
      this.evidence   = options.evidence || [];
      this.reason     = options.reason || "";
    }

    toJSON() {
      return {
        field: this.field, prop: this.prop, value: this.value,
        status: this.status, route: this.route,
        confidence: this.confidence, evidence: this.evidence, reason: this.reason
      };
    }
  }

  // ── FillEpisode ───────────────────────────────────────────────────────────

  class FillEpisode {
    constructor(options = {}) {
      this.id         = options.id || Utils.createId("ep");
      this.domain     = options.domain || "general";
      this.fields     = options.fields || [];
      this.results    = options.results || {};    // Map<field, FillResult>
      this.feedback   = options.feedback || {};
      this.accuracy   = options.accuracy ?? null;
      this.created_at = options.created_at || Utils.nowIso();
    }

    toJSON() {
      const results = {};
      for (const [k, v] of Object.entries(this.results)) {
        results[k] = v && v.toJSON ? v.toJSON() : v;
      }
      return {
        id: this.id, domain: this.domain, fields: this.fields,
        results, feedback: this.feedback,
        accuracy: this.accuracy, created_at: this.created_at
      };
    }
  }

  // ── EpisodicMemory ─────────────────────────────────────────────────────────
  // Tracks all past episodes and per-property historical accuracy (last 20).

  class EpisodicMemory {
    constructor(data = {}) {
      this._episodes = data.episodes || [];
      // fieldHist: Map<prop, string[]>  — each entry: "accept"|"reject"|"correct"
      this._fieldHist = new Map();
      for (const [p, h] of Object.entries(data.fieldHist || {})) {
        this._fieldHist.set(p, h);
      }
    }

    record(episode, feedback) {
      episode.feedback = feedback;
      let hits = 0;
      for (const [field, action] of Object.entries(feedback)) {
        const r = episode.results[field];
        if (!r) continue;
        const base = action.split(":")[0];
        if (r.prop) {
          if (!this._fieldHist.has(r.prop)) this._fieldHist.set(r.prop, []);
          this._fieldHist.get(r.prop).push(base);
          if (this._fieldHist.get(r.prop).length > 40) {
            this._fieldHist.get(r.prop).splice(0, 20);
          }
        }
        if (base === Schema.FeedbackAction.ACCEPT) hits++;
      }
      const n = Object.keys(feedback).length;
      episode.accuracy = n > 0 ? hits / n : null;
      this._episodes.push(episode.toJSON ? episode.toJSON() : episode);
    }

    accuracyFor(prop, window = 20) {
      const hist = (this._fieldHist.get(prop) || []).slice(-window);
      if (!hist.length) return 1.0;
      const W = { accept: 1.0, correct: 0.2, reject: 0.0 };
      return hist.reduce((s, a) => s + (W[a] ?? 0), 0) / hist.length;
    }

    stats() {
      return {
        episodes: this._episodes.length,
        total_feedback: this._episodes.reduce(
          (s, e) => s + Object.keys(e.feedback || {}).length, 0
        ),
        props_tracked: this._fieldHist.size
      };
    }

    serialize() {
      const fieldHist = {};
      for (const [p, h] of this._fieldHist.entries()) fieldHist[p] = h;
      return { episodes: this._episodes, fieldHist };
    }

    static deserialize(data = {}) { return new EpisodicMemory(data); }
  }

  // ── WorkingMemory ─────────────────────────────────────────────────────────

  class WorkingMemory {
    constructor() { this.reset(); }
    reset() {
      this.sessionId      = Utils.createId("session");
      this.activeFields   = [];
      this.partialResults = {};
      this.banditContexts = {};
      this.startedAt      = Utils.nowIso();
    }
  }

  const api = Object.freeze({ FillResult, FillEpisode, EpisodicMemory, WorkingMemory });

  root.AutoFillGraphV5Memory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
