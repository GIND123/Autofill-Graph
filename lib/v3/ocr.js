(function initAutoFillGraphV3OCR(root) {
  "use strict";

  const Utils = root.AutoFillGraphV3Utils;

  if (!Utils) {
    throw new Error("Load utils.js before ocr.js");
  }

  class DOMFormFieldExtractor {
    extract(doc = root.document) {
      if (!doc) return [];
      const inputs = Array.from(doc.querySelectorAll("input, textarea, select"));
      return inputs
        .filter((element) => !["hidden", "submit", "button", "reset"].includes(String(element.type || "").toLowerCase()))
        .map((element) => ({
          element,
          label: this.getLabel(element, doc),
          placeholder: element.placeholder || "",
          name: element.name || "",
          id: element.id || "",
          type: element.type || element.tagName?.toLowerCase() || "text",
          value: element.value || ""
        }))
        .filter((field) => field.label || field.placeholder || field.name || field.id);
    }

    getLabel(element, doc) {
      if (element.id) {
        const label = doc.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) return label.textContent.trim();
      }
      let parent = element.parentElement;
      for (let i = 0; i < 3 && parent; i++) {
        if (parent.tagName?.toLowerCase() === "label") return parent.textContent.trim();
        const label = parent.querySelector?.("label");
        if (label) return label.textContent.trim();
        parent = parent.parentElement;
      }
      return "";
    }
  }

  class OCRFormFieldExtractor {
    constructor(options = {}) {
      this.layoutAdapter = options.layoutAdapter || null;
      this.tesseractAdapter = options.tesseractAdapter || null;
    }

    async extractFromImage(imageInput) {
      if (this.layoutAdapter) {
        try {
          const fields = await this.layoutAdapter.extractFields(imageInput);
          if (fields?.length) return fields;
        } catch (error) {
          console.warn("Layout adapter failed, falling back to OCR:", error.message);
        }
      }

      if (this.tesseractAdapter) {
        const text = await this.tesseractAdapter.extractText(imageInput);
        return this.extractLabelsFromText(text);
      }

      throw new Error("No LayoutLMv3 or Tesseract adapter configured");
    }

    extractLabelsFromText(text) {
      const lines = String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const fields = [];
      for (const line of lines) {
        const colonLabel = line.match(/^(.{2,80}?):\s*$/);
        const requiredLabel = line.match(/^(.{2,80}?)\s*\*$/);
        const candidate = colonLabel?.[1] || requiredLabel?.[1] || null;
        if (candidate && !this.looksLikeSentence(candidate)) {
          fields.push({ label: candidate, source: "ocr_text" });
        }
      }
      return fields;
    }

    looksLikeSentence(text) {
      const normalized = Utils.normalizeText(text);
      return normalized.split(" ").length > 10;
    }
  }

  const api = Object.freeze({
    DOMFormFieldExtractor,
    OCRFormFieldExtractor
  });

  root.AutoFillGraphV3OCR = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
