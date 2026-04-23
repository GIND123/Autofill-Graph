(function initAutoFillGraphV3Utils(root) {
  "use strict";

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^\w\s@.+]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function canonicalId(value) {
    return normalizeText(value).replace(/\s+/g, "_");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value)));
  }

  function safeParseJson(text, fallback = null) {
    if (typeof text !== "string") return fallback;
    const trimmed = text.trim();
    if (!trimmed) return fallback;

    try {
      return JSON.parse(trimmed);
    } catch (_) {
      const first = trimmed.indexOf("{");
      const last = trimmed.lastIndexOf("}");
      if (first >= 0 && last > first) {
        try {
          return JSON.parse(trimmed.slice(first, last + 1));
        } catch (__) {
          return fallback;
        }
      }
      return fallback;
    }
  }

  function dot(a, b) {
    const n = Math.min(a?.length || 0, b?.length || 0);
    let total = 0;
    for (let i = 0; i < n; i++) total += Number(a[i]) * Number(b[i]);
    return total;
  }

  function norm(a) {
    return Math.sqrt(dot(a, a));
  }

  function cosineSimilarity(a, b) {
    const denom = norm(a) * norm(b);
    if (!denom) return 0;
    return dot(a, b) / denom;
  }

  function meanVector(vectors) {
    if (!vectors.length) return [];
    const width = vectors[0].length;
    const out = Array(width).fill(0);
    for (const vector of vectors) {
      for (let i = 0; i < width; i++) out[i] += Number(vector[i] || 0);
    }
    return out.map((value) => value / vectors.length);
  }

  function oneHot(value, values) {
    return values.map((candidate) => (candidate === value ? 1 : 0));
  }

  function unique(values) {
    return Array.from(new Set(values.filter((value) => value !== null && value !== undefined)));
  }

  function createId(prefix = "id") {
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  function latestByValidFrom(values) {
    return [...values].sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from))[0] || null;
  }

  function matrixIdentity(size) {
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => (row === col ? 1 : 0))
    );
  }

  function matrixVectorMul(matrix, vector) {
    return matrix.map((row) => dot(row, vector));
  }

  function outerProduct(a, b) {
    return a.map((x) => b.map((y) => Number(x) * Number(y)));
  }

  function matrixAdd(a, b) {
    return a.map((row, i) => row.map((value, j) => value + b[i][j]));
  }

  function vectorAdd(a, b) {
    const n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, i) => Number(a[i] || 0) + Number(b[i] || 0));
  }

  function vectorScale(vector, scalar) {
    return vector.map((value) => Number(value) * Number(scalar));
  }

  function solveLinearSystem(matrix, vector) {
    const n = matrix.length;
    const aug = matrix.map((row, i) => [...row.map(Number), Number(vector[i] || 0)]);

    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
      }
      if (Math.abs(aug[pivot][col]) < 1e-12) continue;
      [aug[col], aug[pivot]] = [aug[pivot], aug[col]];

      const div = aug[col][col];
      for (let k = col; k <= n; k++) aug[col][k] /= div;

      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = aug[row][col];
        for (let k = col; k <= n; k++) aug[row][k] -= factor * aug[col][k];
      }
    }

    return aug.map((row) => row[n]);
  }

  const api = Object.freeze({
    nowIso,
    normalizeText,
    canonicalId,
    clamp,
    safeParseJson,
    dot,
    norm,
    cosineSimilarity,
    meanVector,
    oneHot,
    unique,
    createId,
    latestByValidFrom,
    matrixIdentity,
    matrixVectorMul,
    outerProduct,
    matrixAdd,
    vectorAdd,
    vectorScale,
    solveLinearSystem
  });

  root.AutoFillGraphV3Utils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
