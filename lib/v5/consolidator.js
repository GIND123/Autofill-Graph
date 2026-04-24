(function initAutoFillGraphV5Consolidator(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;

  if (!Schema || !Utils) throw new Error("Load schema.js and utils.js before consolidator.js");

  // ── MemoryConsolidator ────────────────────────────────────────────────────
  // Mirrors Prototype5 MemoryConsolidator:
  //   accept  → confidence += 0.05 (capped 0.99)
  //   reject  → confidence -= 0.15; retract inferred sources; expire if < FORGET_THRESH
  //   correct → expire active; retract inferred; store new value from feedback
  // Forget pass: any active attr with confidence < FORGET_THRESH is expired.

  const FORGET_THRESH = 0.20;

  class MemoryConsolidator {
    consolidate(episode, feedback, kg) {
      for (const [field, action] of Object.entries(feedback)) {
        const r = episode.results[field];
        if (!r || !r.prop) continue;
        const prop = r.prop;
        const active = (kg._attrs.get(prop) || []).filter(a => a.is_current());
        const base = action.split(":")[0];

        if (base === Schema.FeedbackAction.ACCEPT) {
          for (const a of active) a.confidence = Math.min(0.99, a.confidence + 0.05);

        } else if (base === Schema.FeedbackAction.REJECT) {
          for (const a of active) {
            a.confidence = Math.max(0, a.confidence - 0.15);
            if (a.source && a.source.startsWith("inferred:")) {
              const rule = a.source.replace("inferred:", "");
              kg._retractions.add(`${prop}:${rule}`);
              a.valid_until = Utils.nowIso();
            }
          }

        } else if (base === Schema.FeedbackAction.CORRECT) {
          const newVal = action.split(":").slice(1).join(":");
          for (const a of active) {
            a.valid_until = Utils.nowIso();
            if (a.source && a.source.startsWith("inferred:")) {
              kg._retractions.add(`${prop}:${a.source.replace("inferred:", "")}`);
            }
          }
          if (newVal) kg.store(prop, newVal, "feedback:correct", 1.0);
        }

        // Forget pass: any active attr below threshold
        for (const a of (kg._attrs.get(prop) || [])) {
          if (a.is_current() && a.confidence < FORGET_THRESH) {
            a.valid_until = Utils.nowIso();
          }
        }
      }
    }
  }

  const api = Object.freeze({ MemoryConsolidator, FORGET_THRESH });

  root.AutoFillGraphV5Consolidator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
