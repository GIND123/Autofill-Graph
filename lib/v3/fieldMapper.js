(function initAutoFillGraphV3FieldMapper(root) {
  "use strict";

  const Schema = root.AutoFillGraphV3Schema;
  const Utils = root.AutoFillGraphV3Utils;

  if (!Schema || !Utils) {
    throw new Error("Load schema.js and utils.js before fieldMapper.js");
  }

  class FieldMapper {
    constructor(options = {}) {
      this.threshold = Number(options.threshold ?? 0.45);
      this.embeddingProvider = options.embeddingProvider || null;
      this.learnedMappings = options.learnedMappings || {};
      this.propertyEmbeddings = new Map();
      this.labelCache = new Map();
      this.aliasIndex = this.buildAliasIndex();
    }

    buildAliasIndex() {
      const index = new Map();
      for (const [property, definition] of Object.entries(Schema.PROPERTY_DEFINITIONS)) {
        index.set(Utils.normalizeText(property), property);
        for (const alias of definition.aliases || []) {
          index.set(Utils.normalizeText(alias), property);
        }
      }
      for (const [property, aliases] of Object.entries(this.learnedMappings)) {
        for (const alias of aliases) index.set(Utils.normalizeText(alias), property);
      }
      return index;
    }

    learnMapping(fieldLabel, property) {
      if (!this.learnedMappings[property]) this.learnedMappings[property] = [];
      const normalized = Utils.normalizeText(fieldLabel);
      if (!this.learnedMappings[property].includes(normalized)) {
        this.learnedMappings[property].push(normalized);
        this.aliasIndex.set(normalized, property);
      }
    }

    mapField(fieldLabel) {
      const normalized = Utils.normalizeText(fieldLabel);
      if (!normalized) return null;

      const exact = this.aliasIndex.get(normalized);
      if (exact) return { property: exact, phase: "exact", score: 1.0 };

      let best = null;
      for (const [alias, property] of this.aliasIndex.entries()) {
        if (alias.length < 3) continue;
        if (normalized.includes(alias) || alias.includes(normalized)) {
          const score = Math.min(alias.length, normalized.length) / Math.max(alias.length, normalized.length);
          if (!best || score > best.score) best = { property, phase: "substring", score };
        }
      }
      return best;
    }

    async mapFieldAsync(fieldLabel) {
      const local = this.mapField(fieldLabel);
      if (local) return local;
      if (!this.embeddingProvider) return null;

      await this.ensurePropertyEmbeddings();
      const labelEmbedding = await this.embedLabel(fieldLabel);
      let best = null;
      for (const [property, embedding] of this.propertyEmbeddings.entries()) {
        const score = Utils.cosineSimilarity(labelEmbedding, embedding);
        if (!best || score > best.score) best = { property, phase: "embedding", score };
      }
      return best && best.score >= this.threshold ? best : null;
    }

    async ensurePropertyEmbeddings() {
      if (this.propertyEmbeddings.size) return;
      for (const [property, definition] of Object.entries(Schema.PROPERTY_DEFINITIONS)) {
        const text = `${property}: ${definition.description}`;
        this.propertyEmbeddings.set(property, await this.embeddingProvider.embed(text));
      }
    }

    async embedLabel(fieldLabel) {
      const normalized = Utils.normalizeText(fieldLabel);
      if (!this.labelCache.has(normalized)) {
        this.labelCache.set(normalized, await this.embeddingProvider.embed(fieldLabel));
      }
      return this.labelCache.get(normalized);
    }

    serialize() {
      return {
        threshold: this.threshold,
        learnedMappings: this.learnedMappings
      };
    }
  }

  const api = Object.freeze({ FieldMapper });

  root.AutoFillGraphV3FieldMapper = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
