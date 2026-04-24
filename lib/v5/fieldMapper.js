(function initAutoFillGraphV5FieldMapper(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;

  if (!Schema || !Utils) throw new Error("Load schema.js and utils.js before fieldMapper.js");

  // ── FieldMapper ───────────────────────────────────────────────────────────
  // 3-phase label resolution (mirrors Prototype5 FieldMapper):
  //   Phase 1 — Exact   : normalised text matches alias index
  //   Phase 2 — Substring: overlap ≥ 4 chars
  //   Phase 3 — Embedding: cosine similarity ≥ threshold (64-dim n-gram vectors)
  // OCR variant generation: numeral → letter substitutions.

  const DEFAULT_THRESHOLD = 0.32;

  class FieldMapper {
    constructor(options = {}) {
      this.threshold       = Number(options.threshold ?? DEFAULT_THRESHOLD);
      this.learnedMappings = options.learnedMappings || {};

      // alias index: normalised string → property
      this._alias = new Map();
      // property → embedding vector
      this._propVecs = new Map();

      this._buildIndexes();
    }

    _buildIndexes() {
      this._alias.clear();
      this._propVecs.clear();

      for (const [prop, def] of Object.entries(Schema.PROPERTY_DEFINITIONS)) {
        this._alias.set(Utils.normalizeText(prop), prop);
        for (const a of def.aliases || []) {
          this._alias.set(Utils.normalizeText(a), prop);
        }
        // Embed "{prop name}: {description}"
        const text = `${prop.replace(/_/g, " ")}: ${def.description} ${(def.aliases || []).join(" ")}`;
        this._propVecs.set(prop, Utils.embed(text));
      }

      // Learned mappings override
      for (const [prop, aliases] of Object.entries(this.learnedMappings)) {
        for (const a of aliases) this._alias.set(Utils.normalizeText(a), prop);
      }
    }

    // Generate OCR-normalised variants of a label
    _ocrVariants(label) {
      const raw = String(label || "");
      const norm = Utils.normalizeText(raw);
      const ocr  = Utils.ocrNorm(raw);
      return Utils.unique([norm, ocr].filter(Boolean));
    }

    // ── map(label) → {prop, phase, score} ─────────────────────────────────

    map(label) {
      const variants = this._ocrVariants(label);

      // Phase 1: exact alias match
      for (const v of variants) {
        const p = this._alias.get(v);
        if (p) return { prop: p, phase: "exact", score: 1.0 };
      }

      // Phase 2: substring overlap
      let bestP = null, bestS = 0;
      for (const v of variants) {
        for (const [alias, prop] of this._alias.entries()) {
          if (alias.length < 4) continue;
          if (v.includes(alias) || alias.includes(v)) {
            const s = Math.min(alias.length, v.length) / Math.max(alias.length, v.length);
            if (s > bestS) { bestP = prop; bestS = s; }
          }
        }
      }
      if (bestP) return { prop: bestP, phase: "substring", score: bestS };

      // Phase 3: embedding cosine similarity
      const qVec = Utils.embed(label);
      let embBestP = null, embBestS = 0;
      for (const [prop, vec] of this._propVecs.entries()) {
        const s = Utils.cosineSimilarity(qVec, vec);
        if (s > embBestS) { embBestP = prop; embBestS = s; }
      }
      if (embBestS >= this.threshold) {
        return { prop: embBestP, phase: "embedding", score: embBestS };
      }
      return { prop: null, phase: "unknown", score: embBestS };
    }

    // ── Learn a new label → property mapping ──────────────────────────────

    learnMapping(label, property) {
      if (!label || !property) return;
      const n = Utils.normalizeText(label);
      if (!this.learnedMappings[property]) this.learnedMappings[property] = [];
      if (!this.learnedMappings[property].includes(n)) {
        this.learnedMappings[property].push(n);
        this._alias.set(n, property);
      }
    }

    // ── Label embedding vector (used by router for context) ────────────────
    embedLabel(label) {
      return Utils.embed(label);
    }

    serialize() {
      return { threshold: this.threshold, learnedMappings: this.learnedMappings };
    }

    static deserialize(data = {}) { return new FieldMapper(data); }
  }

  const api = Object.freeze({ FieldMapper });

  root.AutoFillGraphV5FieldMapper = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
