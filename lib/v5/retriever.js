(function initAutoFillGraphV5Retriever(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;

  if (!Schema || !Utils) throw new Error("Load schema.js and utils.js before retriever.js");

  // ── EmbeddingRetriever ────────────────────────────────────────────────────
  // Mirrors Prototype5 EmbeddingRetriever:
  //   - rebuild(kg)           : embed all PUBLIC triples into index
  //   - retrieve(fields, k)   : return top-k triples by cosine similarity
  //   - compression(selected) : 1 - selected / total  (context compression ratio)

  class EmbeddingRetriever {
    constructor() {
      // index: Array<{triple: string, vec: number[]}>
      this.index = [];
    }

    // Rebuild the triple index from the KG
    rebuild(kg) {
      const triples = kg.triples(Schema.Sensitivity.PUBLIC);
      this.index = triples.map(t => ({ triple: t, vec: Utils.embed(t) }));
    }

    // Retrieve top-k triples for a set of field labels
    retrieve(fields, k = null) {
      if (!this.index.length) return [];
      const effectiveK = k !== null ? k : Math.min(15, Math.max(5, fields.length * 2));
      const query = fields.join(" ; ");
      const qVec  = Utils.embed(query);

      const scored = this.index.map(({ triple, vec }) => ({
        triple,
        score: Utils.cosineSimilarity(qVec, vec)
      }));

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, effectiveK).filter(x => x.score >= 0.10);
    }

    // Context compression ratio: how much of the index was selected
    compression(selectedCount) {
      if (!this.index.length) return 0;
      return 1.0 - selectedCount / this.index.length;
    }

    serialize() {
      return { index: this.index };
    }

    static deserialize(data = {}) {
      const r = new EmbeddingRetriever();
      r.index = data.index || [];
      return r;
    }
  }

  const api = Object.freeze({ EmbeddingRetriever });

  root.AutoFillGraphV5Retriever = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
