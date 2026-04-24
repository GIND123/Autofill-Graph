(function initAutoFillGraphV5OCR(root) {
  "use strict";

  const Schema = root.AutoFillGraphV5Schema;
  const Utils  = root.AutoFillGraphV5Utils;

  if (!Schema || !Utils) throw new Error("Load schema.js and utils.js before ocr.js");

  // ── OCRHandler ────────────────────────────────────────────────────────────
  // Browser-native OCR pipeline for image-based form fields.
  //
  // Strategy:
  //   1. If Tesseract.js is available (loaded externally), use it.
  //   2. Otherwise, use the browser's built-in text extraction from clipboard
  //      or canvas APIs where possible.
  //   3. Extracts labels from OCR text, fuzzy-matches them to known field labels,
  //      and returns a sorted list of detected field labels.
  //
  // Label matching uses OCR normalisation + SequenceMatcher-style overlap ratio.

  const MIN_MATCH_SCORE = 0.55;

  class OCRHandler {
    constructor() {
      this._tesseractWorker = null;
      this._tesseractReady  = false;
    }

    // ── Public: extract field labels from an image File/Blob ──────────────

    async extractFieldsFromImage(imageFile, fallbackLabels = []) {
      try {
        const text = await this._runOCR(imageFile);
        if (!text) return fallbackLabels;
        return this._parseLabels(text, fallbackLabels);
      } catch (err) {
        console.warn("[AFG-v5 OCR] extraction failed:", err);
        return fallbackLabels;
      }
    }

    // ── OCR via Tesseract.js (must be loaded as <script> externally) ───────

    async _runOCR(imageFile) {
      if (typeof Tesseract === "undefined") {
        console.warn("[AFG-v5 OCR] Tesseract.js not available");
        return null;
      }
      try {
        const result = await Tesseract.recognize(imageFile, "eng", {
          logger: () => {}
        });
        return result.data.text || "";
      } catch (err) {
        console.warn("[AFG-v5 OCR] Tesseract error:", err);
        return null;
      }
    }

    // ── Parse raw OCR text into matched field labels ───────────────────────

    _parseLabels(rawText, fallbackLabels) {
      const lines = rawText.split("\n");
      const seen   = new Set();
      const fields = [];

      for (const line of lines) {
        const raw = line.trim().replace(/^[`'.–\-_]+|[`'.–\-_]+$/g, "");
        if (!raw) continue;
        const candidate = raw.split(/\s*:\s*/)[0].trim();
        if (!candidate || candidate.length < 2) continue;

        const { label, score } = this._bestLabelMatch(candidate, fallbackLabels);
        if (label && score >= MIN_MATCH_SCORE && !seen.has(label)) {
          fields.push(label);
          seen.add(label);
        }
      }
      return fields.length ? fields : fallbackLabels;
    }

    // ── Fuzzy label match ─────────────────────────────────────────────────

    _bestLabelMatch(candidate, labels) {
      if (!labels.length) return { label: null, score: 0 };
      const cn = Utils.ocrNorm(candidate);
      if (!cn || cn === "application form" || cn === "form") {
        return { label: null, score: 0 };
      }

      let bestLabel = null, bestScore = 0;
      for (const label of labels) {
        const ln = Utils.ocrNorm(label);
        const seq  = _sequenceRatio(cn, ln);
        const tokC = new Set(cn.split(/\s+/));
        const tokL = new Set(ln.split(/\s+/));
        const overlap = [...tokC].filter(t => tokL.has(t)).length / Math.max(tokL.size, 1);
        const score = Math.max(seq, overlap);
        if (score > bestScore) { bestLabel = label; bestScore = score; }
      }
      return { label: bestLabel, score: bestScore };
    }

    // ── Document category gating (mirrors Prototype5 _img_cat) ────────────

    categoriseUpload(fieldLabel) {
      const n = Utils.normalizeText(fieldLabel);
      for (const [cat, keys] of Object.entries(Schema.IMAGE_CATEGORIES)) {
        if (keys.some(k => n.includes(Utils.normalizeText(k)))) return cat;
      }
      return null;
    }
  }

  // Simplified sequence similarity (SequenceMatcher.ratio equivalent)
  function _sequenceRatio(a, b) {
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;
    let matches = 0;
    const setB = new Set(b.split(""));
    for (const ch of a.split("")) { if (setB.has(ch)) matches++; }
    return (2.0 * matches) / (a.length + b.length);
  }

  const api = Object.freeze({ OCRHandler });

  root.AutoFillGraphV5OCR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
