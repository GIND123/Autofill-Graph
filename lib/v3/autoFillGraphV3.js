(function initAutoFillGraphV3Core(root) {
  "use strict";

  const Schema = root.AutoFillGraphV3Schema;
  const Utils = root.AutoFillGraphV3Utils;
  const Memory = root.AutoFillGraphV3Memory;
  const FieldMapperApi = root.AutoFillGraphV3FieldMapper;
  const RetrieverApi = root.AutoFillGraphV3Retriever;
  const RouterApi = root.AutoFillGraphV3Router;
  const Resolvers = root.AutoFillGraphV3Resolvers;
  const LLM = root.AutoFillGraphV3LLM;

  if (!Schema || !Utils || !Memory || !FieldMapperApi || !RetrieverApi || !RouterApi || !Resolvers || !LLM) {
    throw new Error("Load all v3 dependencies before autoFillGraphV3.js");
  }

  class AutoFillGraphV3Core {
    constructor(options = {}) {
      this.semanticMemory = options.semanticMemory || new Memory.SemanticMemory(options.semanticData);
      this.episodicMemory = options.episodicMemory || new Memory.EpisodicMemory(options.episodicData);
      this.workingMemory = options.workingMemory || new Memory.WorkingMemory();
      this.fieldMapper = options.fieldMapper || new FieldMapperApi.FieldMapper({
        embeddingProvider: options.embeddingProvider,
        learnedMappings: options.learnedMappings
      });
      this.retriever = options.retriever || new RetrieverApi.EmbeddingRetriever({
        embeddingProvider: options.embeddingProvider
      });
      this.router = options.router || new RouterApi.LinUCBRouter({
        dimension: options.routerDimension || 390
      });
      this.domainGuard = options.domainGuard || new Resolvers.DomainGuard();
      this.compositionalResolver = options.compositionalResolver || new Resolvers.CompositionalResolver();
      this.inferenceEngine = options.inferenceEngine || new Resolvers.InferenceEngine();
      this.consolidator = options.consolidator || new Resolvers.MemoryConsolidator();
      this.llmClient = options.llmClient || new LLM.MistralLLMClient({ apiKey: options.apiKey });
      this.embeddingProvider = options.embeddingProvider || null;
    }

    async learnFromForm(formData, context = "form") {
      for (const [label, value] of Object.entries(formData || {})) {
        if (value === null || value === undefined || String(value).trim() === "") continue;
        const mapped = await this.fieldMapper.mapFieldAsync(label);
        const property = mapped?.property || Utils.canonicalId(label);
        this.semanticMemory.storeAttribute("user", property, value, {
          source: context,
          confidence: mapped ? 0.95 : 0.75,
          provenance: [{ label, phase: mapped?.phase || "raw" }]
        });
        if (mapped) this.fieldMapper.learnMapping(label, property);
      }

      const inferred = this.inferenceEngine.infer(this.semanticMemory);
      if (this.embeddingProvider) await this.retriever.rebuild(this.semanticMemory);
      return { inferred, semanticMemory: this.semanticMemory.serialize() };
    }

    async autofillForm(fieldLabels, formDomain = "general") {
      this.workingMemory.reset();
      this.workingMemory.active_fields = fieldLabels;

      const episode = new Memory.FillEpisode({ form_domain: formDomain, fields: fieldLabels });
      const attrs = this.semanticMemory.getCurrentAttributes("user", Schema.Sensitivity.PUBLIC);
      const queuedForLlm = [];
      const results = {};

      for (const field of fieldLabels) {
        const mapped = await this.fieldMapper.mapFieldAsync(field);
        const property = mapped?.property || null;

        if (property && this.domainGuard.shouldAbstain(this.semanticMemory, property)) {
          const result = this.domainGuard.resultFor(field, property);
          results[field] = result;
          episode.addResult(result);
          continue;
        }

        if (property && attrs[property] !== undefined) {
          const result = new Memory.FillResult(field, {
            property,
            value: attrs[property],
            status: Schema.FillStatus.FILLED,
            route: Schema.Route.LOCAL,
            confidence: this.episodicMemory.calibrateConfidence(property, mapped.score || 0.95),
            evidence: [{ property, phase: mapped.phase, score: mapped.score }]
          });
          results[field] = result;
          episode.addResult(result);
          continue;
        }

        const compositional = this.compositionalResolver.resolve(field, attrs);
        if (compositional) {
          results[field] = compositional;
          episode.addResult(compositional);
          continue;
        }

        queuedForLlm.push(field);
      }

      if (queuedForLlm.length && this.llmClient?.apiKey) {
        const context = this.embeddingProvider ? await this.retriever.retrieve(queuedForLlm) : [];
        const llmResponse = await this.llmClient.fillFields({ fields: queuedForLlm, contextTriples: context, attrs });
        for (const field of queuedForLlm) {
          const value = llmResponse.filled?.[field] || "UNKNOWN";
          const result = new Memory.FillResult(field, {
            value,
            status: value === "UNKNOWN" ? Schema.FillStatus.UNKNOWN : Schema.FillStatus.GENERATED,
            route: Schema.Route.RETRIEVAL_LLM,
            confidence: value === "UNKNOWN" ? 0 : 0.81,
            evidence: context.map((item) => ({ sentence: item.triple?.sentence, score: item.score }))
          });
          results[field] = result;
          episode.addResult(result);
        }
      } else {
        for (const field of queuedForLlm) {
          const result = new Memory.FillResult(field, {
            status: Schema.FillStatus.UNKNOWN,
            route: Schema.Route.LOCAL,
            confidence: 0,
            reason: "No local value and no LLM client/API key configured."
          });
          results[field] = result;
          episode.addResult(result);
        }
      }

      return {
        filled: Object.fromEntries(Object.entries(results).map(([field, result]) => [field, result.value])),
        results: Object.fromEntries(Object.entries(results).map(([field, result]) => [field, result.toJSON()])),
        episode
      };
    }

    async processFeedback(episode, feedback) {
      const processed = this.consolidator.processFeedback({
        episode,
        feedback,
        semanticMemory: this.semanticMemory,
        episodicMemory: this.episodicMemory,
        router: this.router
      });
      this.inferenceEngine.infer(this.semanticMemory);
      if (this.embeddingProvider) await this.retriever.rebuild(this.semanticMemory);
      return processed;
    }

    serialize() {
      return {
        semanticMemory: this.semanticMemory.serialize(),
        episodicMemory: this.episodicMemory.serialize(),
        fieldMapper: this.fieldMapper.serialize(),
        router: this.router.serialize(),
        retriever: this.retriever.serialize()
      };
    }
  }

  const api = Object.freeze({ AutoFillGraphV3Core });

  root.AutoFillGraphV3 = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
