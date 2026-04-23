(function initAutoFillGraphV3Index(root) {
  "use strict";

  const api = Object.freeze({
    schema: root.AutoFillGraphV3Schema,
    utils: root.AutoFillGraphV3Utils,
    memory: root.AutoFillGraphV3Memory,
    fieldMapper: root.AutoFillGraphV3FieldMapper,
    retriever: root.AutoFillGraphV3Retriever,
    router: root.AutoFillGraphV3Router,
    resolvers: root.AutoFillGraphV3Resolvers,
    llm: root.AutoFillGraphV3LLM,
    ocr: root.AutoFillGraphV3OCR,
    storage: root.AutoFillGraphV3Storage,
    core: root.AutoFillGraphV3,
    importScriptsOrder: [
      "lib/v3/schema.js",
      "lib/v3/utils.js",
      "lib/v3/memory.js",
      "lib/v3/fieldMapper.js",
      "lib/v3/retriever.js",
      "lib/v3/router.js",
      "lib/v3/resolvers.js",
      "lib/v3/llmClient.js",
      "lib/v3/ocr.js",
      "lib/v3/storage.js",
      "lib/v3/autoFillGraphV3.js",
      "lib/v3/index.js"
    ]
  });

  root.AutoFillGraphV3Index = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
