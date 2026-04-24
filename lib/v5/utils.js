(function initAutoFillGraphV5Utils(root) {
  "use strict";

  // ── Basic helpers ────────────────────────────────────────────────────────────

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^\w\s@.+/\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function canonicalId(value) {
    return normalizeText(value).replace(/\s+/g, "_").replace(/^_+|_+$/g, "");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value)));
  }

  function createId(prefix = "id") {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
  }

  function safeParseJson(text, fallback = null) {
    if (typeof text !== "string") return fallback;
    const t = text.trim();
    if (!t) return fallback;
    try { return JSON.parse(t); } catch (_) {}
    for (const [os, oe] of [["{", "}"], ["[", "]"]]) {
      const s = t.indexOf(os), e = t.lastIndexOf(oe);
      if (s >= 0 && e > s) {
        try { return JSON.parse(t.slice(s, e + 1)); } catch (_) {}
      }
    }
    return fallback;
  }

  // ── OCR character normalisation (mirrors Prototype5) ────────────────────────

  function ocrNorm(text) {
    const fixed = String(text || "")
      .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e")
      .replace(/5/g, "s").replace(/\|/g, "l")
      .replace(/\buplead\b/gi, "upload")
      .replace(/\bprofle\b/gi, "profile")
      .replace(/\bphot\b/gi, "photo")
      .replace(/^apa$/gi, "gpa");
    return normalizeText(fixed);
  }

  // ── Vector maths ─────────────────────────────────────────────────────────────

  function dot(a, b) {
    const n = Math.min((a || []).length, (b || []).length);
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(a[i]) * Number(b[i]);
    return s;
  }

  function norm(a) { return Math.sqrt(dot(a, a)); }

  function cosineSimilarity(a, b) {
    const d = norm(a) * norm(b);
    return d ? dot(a, b) / d : 0;
  }

  function vecAdd(a, b) {
    const n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, i) => Number(a[i] || 0) + Number(b[i] || 0));
  }

  function vecScale(v, s) { return v.map(x => Number(x) * Number(s)); }

  function outerProduct(a, b) { return a.map(x => b.map(y => Number(x) * Number(y))); }

  function matrixIdentity(d) {
    return Array.from({ length: d }, (_, r) => Array.from({ length: d }, (_, c) => r === c ? 1 : 0));
  }

  function matrixAdd(A, B) { return A.map((row, i) => row.map((v, j) => v + B[i][j])); }

  function matrixVecMul(M, v) { return M.map(row => dot(row, v)); }

  function solveLinearSystem(A, b) {
    const n = A.length;
    const aug = A.map((row, i) => [...row.map(Number), Number(b[i] || 0)]);
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
        const f = aug[row][col];
        for (let k = col; k <= n; k++) aug[row][k] -= f * aug[col][k];
      }
    }
    return aug.map(row => row[n]);
  }

  // ── Lightweight n-gram hash embedding ───────────────────────────────────────
  // FNV-1a based, produces 64-dim normalised float vector.
  // Handles OCR noise well (character-level n-grams).

  const EMBED_DIM = 64;

  function _fnv32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  }

  function embed(text) {
    const s = normalizeText(text);
    const vec = new Float32Array(EMBED_DIM);
    if (!s) return Array.from(vec);
    // unigrams, bigrams, trigrams
    for (let ng = 1; ng <= 3; ng++) {
      const w = ng === 1 ? 1.0 : ng === 2 ? 1.5 : 2.0;
      for (let i = 0; i <= s.length - ng; i++) {
        const gram = s.slice(i, i + ng);
        const idx = _fnv32(gram) % EMBED_DIM;
        vec[idx] += w;
      }
    }
    // word tokens (extra weight)
    for (const tok of s.split(/\s+/)) {
      if (tok.length >= 2) {
        vec[_fnv32(tok) % EMBED_DIM] += 3.0;
      }
    }
    // normalise
    let n = 0;
    for (let i = 0; i < EMBED_DIM; i++) n += vec[i] * vec[i];
    n = Math.sqrt(n) || 1;
    const out = new Array(EMBED_DIM);
    for (let i = 0; i < EMBED_DIM; i++) out[i] = vec[i] / n;
    return out;
  }

  function latestByValidFrom(values) {
    return [...values].sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from))[0] || null;
  }

  function unique(arr) {
    return Array.from(new Set((arr || []).filter(v => v !== null && v !== undefined)));
  }

  const api = Object.freeze({
    nowIso, normalizeText, canonicalId, clamp, createId, safeParseJson,
    ocrNorm, dot, norm, cosineSimilarity, vecAdd, vecScale, outerProduct,
    matrixIdentity, matrixAdd, matrixVecMul, solveLinearSystem,
    embed, EMBED_DIM, latestByValidFrom, unique
  });

  root.AutoFillGraphV5Utils = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
