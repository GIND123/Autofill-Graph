(function initAutoFillGraphV5CompositionalResolver(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;
  const Memory = root.AutoFillGraphV5Memory;

  if (!Schema || !Utils || !Memory) {
    throw new Error("Load schema.js, utils.js and memory.js before compositionalResolver.js");
  }

  // ── CompositionalResolver ─────────────────────────────────────────────────
  // Extended trigger set + phrase matching, mirrors Prototype5 resolver.

  const TRIGGERS = {
    full_address: {
      components: ["address", "city", "state", "zip_code"],
      minN: 2,
      phrases: [
        "full address", "full residential address", "residential address",
        "mailing address", "complete address", "current address",
        "full residential", "complete residential address"
      ]
    },
    residential_address: {
      components: ["address", "city", "state", "zip_code", "country"],
      minN: 2,
      phrases: ["residential address with country", "complete residential address with country"]
    },
    contact_info: {
      components: ["email", "phone"],
      minN: 2,
      phrases: [
        "contact info", "contact information", "contact details",
        "how to contact", "contact"
      ]
    },
    academic_info: {
      components: ["university", "department", "degree"],
      minN: 2,
      phrases: [
        "academic info", "academic information", "academic profile",
        "academic background", "educational background"
      ]
    },
    professional_profile: {
      components: ["employer", "job_title", "skills"],
      minN: 2,
      phrases: [
        "professional profile", "professional details", "career profile",
        "professional background", "career details"
      ]
    }
  };

  class CompositionalResolver {
    resolve(fieldLabel, cur) {
      const n = Utils.normalizeText(fieldLabel);

      for (const [key, def] of Object.entries(TRIGGERS)) {
        const matched = def.phrases.some(phrase => n.includes(Utils.normalizeText(phrase)));
        if (!matched) continue;

        // Build composite value
        const vals = _compose(key, def.components, cur);
        const pass = key.includes("address") && cur.address
          ? vals.length >= 1
          : vals.length >= def.minN;

        if (pass) {
          return new Memory.FillResult(fieldLabel, {
            prop: key,
            value: vals.join(", "),
            status: Schema.FillStatus.FILLED,
            route: Schema.Route.COMPOSITIONAL,
            confidence: 0.90,
            evidence: def.components.filter(p => cur[p]).map(p => `${p}=${cur[p]}`)
          });
        }
      }
      return null;
    }
  }

  function _compose(key, comps, cur) {
    if (key === "full_address" || key === "residential_address") {
      if (!cur.address) return [];
      const base = String(cur.address).trim();
      const normBase = Utils.normalizeText(base);
      const extras = comps.slice(1)
        .filter(p => cur[p] && !normBase.includes(Utils.normalizeText(String(cur[p]))))
        .map(p => String(cur[p]).trim());
      return [base, ...extras];
    }
    return comps.filter(p => cur[p]).map(p => String(cur[p]).trim());
  }

  const api = Object.freeze({ CompositionalResolver });

  root.AutoFillGraphV5CompositionalResolver = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
