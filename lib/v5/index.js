(function initAutoFillGraphV5Index(root) {
  "use strict";

  // ── AutoFillGraph v5 — Public API ─────────────────────────────────────────
  // Load order (in manifest.json / HTML <script> tags):
  //   1. utils.js
  //   2. schema.js
  //   3. temporalKG.js
  //   4. memory.js
  //   5. consolidator.js
  //   6. fieldMapper.js
  //   7. router.js
  //   8. retriever.js
  //   9. inferenceEngine.js
  //  10. compositionalResolver.js
  //  11. llmClient.js
  //  12. narrator.js
  //  13. ocr.js
  //  14. storage.js
  //  15. autoFillAgentV5.js
  //  16. index.js

  const modules = [
    "AutoFillGraphV5Utils",
    "AutoFillGraphV5Schema",
    "AutoFillGraphV5TemporalKG",
    "AutoFillGraphV5Memory",
    "AutoFillGraphV5Consolidator",
    "AutoFillGraphV5FieldMapper",
    "AutoFillGraphV5Router",
    "AutoFillGraphV5Retriever",
    "AutoFillGraphV5InferenceEngine",
    "AutoFillGraphV5CompositionalResolver",
    "AutoFillGraphV5LLMClient",
    "AutoFillGraphV5Narrator",
    "AutoFillGraphV5OCR",
    "AutoFillGraphV5Storage",
    "AutoFillGraphV5Agent"
  ];

  for (const m of modules) {
    if (!root[m]) throw new Error(`AutoFillGraph v5: module ${m} not loaded`);
  }

  const api = Object.freeze({
    // Schema primitives
    Schema:     root.AutoFillGraphV5Schema,
    Utils:      root.AutoFillGraphV5Utils,
    // Core data structures
    TemporalKG:           root.AutoFillGraphV5TemporalKG.TemporalKG,
    FillResult:           root.AutoFillGraphV5Memory.FillResult,
    FillEpisode:          root.AutoFillGraphV5Memory.FillEpisode,
    EpisodicMemory:       root.AutoFillGraphV5Memory.EpisodicMemory,
    WorkingMemory:        root.AutoFillGraphV5Memory.WorkingMemory,
    MemoryConsolidator:   root.AutoFillGraphV5Consolidator.MemoryConsolidator,
    // ML components
    FieldMapper:          root.AutoFillGraphV5FieldMapper.FieldMapper,
    LinUCBRouter:         root.AutoFillGraphV5Router.LinUCBRouter,
    EmbeddingRetriever:   root.AutoFillGraphV5Retriever.EmbeddingRetriever,
    InferenceEngine:      root.AutoFillGraphV5InferenceEngine.InferenceEngine,
    CompositionalResolver:root.AutoFillGraphV5CompositionalResolver.CompositionalResolver,
    // LLM & generation
    MistralClient:        root.AutoFillGraphV5LLMClient.MistralClient,
    Narrator:             root.AutoFillGraphV5Narrator.Narrator,
    OCRHandler:           root.AutoFillGraphV5OCR.OCRHandler,
    // Persistence
    StorageManager:       root.AutoFillGraphV5Storage.StorageManager,
    // Main agent
    AutoFillAgentV5:      root.AutoFillGraphV5Agent.AutoFillAgentV5,
    // Version
    VERSION:              "5.0.0"
  });

  root.AutoFillGraphV5 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
