(function initAutoFillGraphV3Retriever(root) {
  "use strict";

  const Schema = root.AutoFillGraphV3Schema;
  const Utils = root.AutoFillGraphV3Utils;

  if (!Schema || !Utils) {
    throw new Error("Load schema.js and utils.js before retriever.js");
  }

  class NullEmbeddingProvider {
    async embed() {
      throw new Error("No embedding provider configured");
    }
  }

  class EmbeddingRetriever {
    constructor(options = {}) {
      this.embeddingProvider = options.embeddingProvider || new NullEmbeddingProvider();
      this.minSimilarity = Number(options.minSimilarity ?? 0.15);
      this.maxK = Number(options.maxK ?? 15);
      this.index = [];
    }

    async rebuild(semanticMemory, maxSensitivity = Schema.Sensitivity.PUBLIC) {
      const triples = semanticMemory.toTriples(maxSensitivity);
      this.index = [];
      for (const triple of triples) {
        this.index.push({
          triple,
          embedding: await this.embeddingProvider.embed(triple.sentence)
        });
      }
      return this.index.length;
    }

    adaptiveK(numFields) {
      return Math.min(this.maxK, Math.max(5, Number(numFields || 1) * 2));
    }

    async retrieve(fieldLabels, options = {}) {
      const labels = Array.isArray(fieldLabels) ? fieldLabels : [fieldLabels];
      const query = labels.join(" ; ");
      const embedding = await this.embeddingProvider.embed(query);
      const k = Number(options.k || this.adaptiveK(labels.length));
      const minSimilarity = Number(options.minSimilarity ?? this.minSimilarity);

      return this.index
        .map((entry) => ({
          ...entry,
          score: Utils.cosineSimilarity(embedding, entry.embedding)
        }))
        .filter((entry) => entry.score >= minSimilarity)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    }

    compressionRatio(selectedCount = 0) {
      if (!this.index.length) return 0;
      return 1 - selectedCount / this.index.length;
    }

    serialize() {
      return {
        minSimilarity: this.minSimilarity,
        maxK: this.maxK,
        index: this.index.map(({ triple, embedding }) => ({ triple, embedding }))
      };
    }

    deserialize(data = {}) {
      this.minSimilarity = Number(data.minSimilarity ?? this.minSimilarity);
      this.maxK = Number(data.maxK ?? this.maxK);
      this.index = data.index || [];
    }
  }

  const api = Object.freeze({
    NullEmbeddingProvider,
    EmbeddingRetriever
  });

  root.AutoFillGraphV3Retriever = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
