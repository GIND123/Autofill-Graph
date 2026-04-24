(function initAutoFillGraphV5Agent(root) {
  "use strict";

  const Schema   = root.AutoFillGraphV5Schema;
  const Utils    = root.AutoFillGraphV5Utils;
  const TemporalKGApi    = root.AutoFillGraphV5TemporalKG;
  const MemoryApi        = root.AutoFillGraphV5Memory;
  const ConsolidatorApi  = root.AutoFillGraphV5Consolidator;
  const FieldMapperApi   = root.AutoFillGraphV5FieldMapper;
  const RouterApi        = root.AutoFillGraphV5Router;
  const RetrieverApi     = root.AutoFillGraphV5Retriever;
  const InferenceApi     = root.AutoFillGraphV5InferenceEngine;
  const CompositionalApi = root.AutoFillGraphV5CompositionalResolver;
  const LLMApi           = root.AutoFillGraphV5LLMClient;
  const NarratorApi      = root.AutoFillGraphV5Narrator;
  const OCRApi           = root.AutoFillGraphV5OCR;

  const REQUIRED = [
    Schema, Utils, TemporalKGApi, MemoryApi, ConsolidatorApi,
    FieldMapperApi, RouterApi, RetrieverApi, InferenceApi,
    CompositionalApi, LLMApi, NarratorApi, OCRApi
  ];
  if (REQUIRED.some(m => !m)) {
    throw new Error("AutoFillAgentV5: one or more required modules not loaded.");
  }

  // ── AutoFillAgentV5 ───────────────────────────────────────────────────────
  // Full agentic orchestrator mirroring Prototype5 AutoFillAgent.
  //
  // Pipeline:
  //   1. Image gate       — document upload fields → IMAGE route
  //   2. Compositional    — multi-part fields (full_address, contact_info…)
  //   3. Field mapping    — 3-phase label resolution
  //   4. Domain guard     — abstain if sensitive domain has no user data
  //   5. Local lookup     — direct KG hit → LOCAL route, bandit stats
  //   6. Inferred         — bandit decides LOCAL vs LLM for inferred-only values
  //   7. LLM batch        — retrieval-augmented generation via Mistral
  //   8. Long-form QA     — answerQuestion() for narrative fields

  class AutoFillAgentV5 {
    constructor(options = {}) {
      this.kg           = new TemporalKGApi.TemporalKG(options.kg);
      this.epi          = new MemoryApi.EpisodicMemory(options.epi);
      this.working      = new MemoryApi.WorkingMemory();
      this.mapper       = new FieldMapperApi.FieldMapper(options.fieldMapper);
      this.router       = new RouterApi.LinUCBRouter(options.router);
      this.retriever    = new RetrieverApi.EmbeddingRetriever();
      this.inf          = new InferenceApi.InferenceEngine();
      this.comp         = new CompositionalApi.CompositionalResolver();
      this.consolidator = new ConsolidatorApi.MemoryConsolidator();
      this.ocr          = new OCRApi.OCRHandler();
      this.llm          = options.llm || new LLMApi.MistralClient({ apiKey: options.apiKey || "" });
      this.narrator     = new NarratorApi.Narrator(this.llm, this.retriever);
      this._epCounter   = options.epCounter || 0;

      // Rebuild retriever index if KG already has data
      if (options.kg) this.retriever.rebuild(this.kg);
    }

    // ── Learn from a form submission ───────────────────────────────────────
    // form: {label: value, ...}
    // returns { learned: [{label, prop, value, phase, score}], inferred: [{prop, value, rule}] }

    learn(form, context = "human") {
      const learned = [];
      for (const [label, value] of Object.entries(form)) {
        const v = String(value || "").trim();
        if (!v || v === "UNKNOWN") continue;

        const { prop, phase, score } = this.mapper.map(label);
        const finalProp = prop || Utils.canonicalId(label);

        this.kg.store(finalProp, v, context, Math.max(score, 0.80));
        this.mapper.learnMapping(label, finalProp);
        learned.push({ label, prop: finalProp, value: v, phase, score: Math.round(score * 1000) / 1000 });

        // Add organisation relations
        if (finalProp === "university") this.kg.addEntity(Schema.EntityType.ORGANIZATION, v, Schema.RelationType.STUDIED_AT);
        if (finalProp === "employer")   this.kg.addEntity(Schema.EntityType.ORGANIZATION, v, Schema.RelationType.EMPLOYED_AT);
      }

      const inferred = this.inf.run(this.kg);
      this.retriever.rebuild(this.kg);
      return { learned, inferred };
    }

    // ── Autofill a list of field labels ────────────────────────────────────
    // Returns FillEpisode (async due to LLM batch)

    async autofill(fields, domain = "general", useLlm = true) {
      this._epCounter++;
      const epId = `ep_${String(this._epCounter).padStart(4, "0")}`;
      this.working.reset();
      this.working.activeFields = fields;

      // Determine max sensitivity level for this domain
      const maxSens = Schema.DOMAIN_MAX_SENSITIVITY[domain] || Schema.Sensitivity.PUBLIC;
      const cur     = this.kg.current(maxSens);

      const results = {};
      const llmQueue = [];
      const llmPropMap = {};

      for (const label of fields) {
        // 1. Image gate
        const imgCat = this.ocr.categoriseUpload(label);
        if (imgCat && cur[imgCat]) {
          results[label] = new MemoryApi.FillResult(label, {
            prop: imgCat, value: cur[imgCat],
            status: Schema.FillStatus.IMAGE_FILLED,
            route: Schema.Route.IMAGE, confidence: 0.95
          });
          continue;
        }

        // 2. Compositional
        const comp = this.comp.resolve(label, cur);
        if (comp) { results[label] = comp; continue; }

        // 3. Field mapping
        const { prop, phase, score } = this.mapper.map(label);

        // 4. Domain guard
        if (prop) {
          const propDomain = _domainOf(prop);
          if (propDomain && !this.kg.hasDomainData(propDomain)) {
            results[label] = new MemoryApi.FillResult(label, {
              prop, value: "UNKNOWN",
              status: Schema.FillStatus.UNKNOWN,
              route: Schema.Route.DOMAIN_GUARD,
              confidence: 0, reason: `no_${propDomain}_data`
            });
            continue;
          }
        }

        // 5. Direct KG lookup
        if (prop && cur[prop] !== undefined) {
          const histAcc = this.epi.accuracyFor(prop);
          const conf    = Math.min(0.99, 0.6 * Math.max(score, 0.7) + 0.4 * histAcc);
          results[label] = new MemoryApi.FillResult(label, {
            prop, value: cur[prop],
            status: Schema.FillStatus.FILLED,
            route: Schema.Route.LOCAL, confidence: conf,
            evidence: [`${phase}:${score.toFixed(3)}`]
          });
          // Register bandit decision so stats accumulate
          const lEmb = this.mapper.embedLabel(label);
          this.router.select(lEmb, domain, true, label);
          continue;
        }

        // 6. Inferred-only values → bandit decides route
        const inferredVals = (this.kg._attrs.get(prop || "") || [])
          .filter(a => a.is_current() && a.source && a.source.startsWith("inferred:"));
        const hasLocal = inferredVals.length > 0;
        const lEmb = this.mapper.embedLabel(label);
        const { armIdx } = this.router.select(lEmb, domain, hasLocal, label);

        if (armIdx === 0 || (armIdx === 1 && !useLlm)) {
          if (inferredVals.length) {
            const best = inferredVals.sort((a, b) => b.confidence - a.confidence)[0];
            results[label] = new MemoryApi.FillResult(label, {
              prop, value: best.value,
              status: Schema.FillStatus.INFERRED,
              route: Schema.Route.INFERENCE,
              confidence: best.confidence, evidence: [best.source]
            });
          } else {
            results[label] = new MemoryApi.FillResult(label, {
              prop, value: "UNKNOWN",
              status: Schema.FillStatus.UNKNOWN,
              route: Schema.Route.LOCAL, confidence: 0, reason: "no_data"
            });
          }
        } else {
          llmQueue.push(label);
          llmPropMap[label] = prop;
        }
      }

      // 7. LLM batch fill
      if (llmQueue.length && this.llm.available()) {
        await this._llmBatchFill(llmQueue, llmPropMap, cur, domain, results);
      } else {
        for (const label of llmQueue) {
          results[label] = results[label] || new MemoryApi.FillResult(label, {
            prop: llmPropMap[label], value: "UNKNOWN",
            status: Schema.FillStatus.UNKNOWN,
            route: Schema.Route.LOCAL, confidence: 0,
            reason: "llm_unavailable"
          });
        }
      }

      // Ensure all fields have a result
      for (const label of fields) {
        if (!results[label]) {
          results[label] = new MemoryApi.FillResult(label, {
            prop: null, value: "UNKNOWN",
            status: Schema.FillStatus.UNKNOWN,
            route: Schema.Route.LOCAL, confidence: 0, reason: "no_route"
          });
        }
      }

      return new MemoryApi.FillEpisode({ id: epId, domain, fields, results });
    }

    // ── LLM batch autofill (retrieval-augmented) ───────────────────────────

    async _llmBatchFill(llmQueue, llmPropMap, cur, domain, results) {
      const retrieved   = this.retriever.retrieve(llmQueue);
      const ctxTriples  = retrieved.map(x => x.triple);
      const compRatio   = this.retriever.compression(retrieved.length);
      const pubAttrs    = {};
      for (const [k, v] of Object.entries(cur)) {
        if (Schema.getSensitivityForProperty(k) === Schema.Sensitivity.PUBLIC) pubAttrs[k] = v;
      }

      const sysPrompt  = (
        "You are an autofill agent. Fill ONLY from the provided memory. " +
        "Never fabricate sensitive data. Return valid JSON."
      );
      const userPrompt = [
        `Fields: ${JSON.stringify(llmQueue)}`,
        `Memory (${ctxTriples.length}/${this.retriever.index.length} triples, ${Math.round(compRatio * 100)}% compressed):`,
        ...ctxTriples.map(t => `  - ${t}`),
        `Public profile: ${JSON.stringify(pubAttrs)}`,
        `Return JSON: {"filled": {"<Field Label>": "<value or UNKNOWN>"}}`
      ].join("\n");

      const res    = await this.llm.chatJson(userPrompt, sysPrompt);
      const filled = (res && res.filled) ? res.filled : {};

      for (const label of llmQueue) {
        const val  = filled[label] || "UNKNOWN";
        const st   = (val === "UNKNOWN" || !val) ? Schema.FillStatus.UNKNOWN : Schema.FillStatus.GENERATED;
        const conf = st === Schema.FillStatus.UNKNOWN ? 0 : 0.85;
        results[label] = new MemoryApi.FillResult(label, {
          prop: llmPropMap[label], value: val, status: st,
          route: Schema.Route.RETRIEVAL_LLM, confidence: conf,
          evidence: [`retrieved:${ctxTriples.length}`, `comp:${compRatio.toFixed(2)}`]
        });
      }
    }

    // ── Long-form QA ───────────────────────────────────────────────────────

    async answerQuestion(question, maxWords = 60) {
      return this.narrator.answerQuestion(question, maxWords);
    }

    // ── Process feedback (HITL) ────────────────────────────────────────────

    feedback(episode, fb) {
      this.consolidator.consolidate(episode, fb, this.kg);
      this.epi.record(episode, fb);
      for (const [field, action] of Object.entries(fb)) {
        const base   = action.split(":")[0];
        const reward = this.router.rewardFromFeedback(base);
        this.router.updateForLabel(field, reward);
      }
      this.inf.run(this.kg);
      this.retriever.rebuild(this.kg);
    }

    // ── OCR: extract fields from an image File ─────────────────────────────

    async extractFieldsFromImage(imageFile, fallbackLabels = []) {
      return this.ocr.extractFieldsFromImage(imageFile, fallbackLabels);
    }

    // ── Stats snapshot ─────────────────────────────────────────────────────

    stats() {
      return {
        ...this.kg.graphStats(),
        epi:        this.epi.stats(),
        bandit:     this.router.stats(),
        retriever:  this.retriever.index.length,
        llm_calls:  this.llm.calls,
        llm_tokens: this.llm.tokensUsed
      };
    }

    // ── Serialise / deserialise ────────────────────────────────────────────

    serialize() {
      return {
        kg:          this.kg.serialize(),
        epi:         this.epi.serialize(),
        fieldMapper: this.mapper.serialize(),
        router:      this.router.serialize(),
        retriever:   this.retriever.serialize(),
        epCounter:   this._epCounter
      };
    }

    static deserialize(data = {}, options = {}) {
      return new AutoFillAgentV5({
        kg:          data.kg,
        epi:         data.epi,
        fieldMapper: data.fieldMapper,
        router:      data.router,
        epCounter:   data.epCounter || 0,
        apiKey:      options.apiKey || "",
        llm:         options.llm || null
      });
    }
  }

  // ── Helper: which domain does a property belong to? ────────────────────────

  function _domainOf(prop) {
    const guardedDomains = ["medical", "financial", "legal"];
    for (const domain of guardedDomains) {
      if ((Schema.DOMAIN_PROPERTIES[domain] || []).includes(prop)) return domain;
    }
    return null;
  }

  const api = Object.freeze({ AutoFillAgentV5 });

  root.AutoFillGraphV5Agent = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
