(function initAutoFillGraphV3LLMClient(root) {
  "use strict";

  const Utils = root.AutoFillGraphV3Utils;

  if (!Utils) {
    throw new Error("Load utils.js before llmClient.js");
  }

  class MistralLLMClient {
    constructor(options = {}) {
      this.apiKey = options.apiKey || "";
      this.model = options.model || "mistral-small-latest";
      this.endpoint = options.endpoint || "https://api.mistral.ai/v1/chat/completions";
      this.fetchImpl = options.fetchImpl || root.fetch?.bind(root);
      this.apiCalls = 0;
    }

    async chatJson(messages, options = {}) {
      if (!this.apiKey) throw new Error("Mistral API key not configured");
      if (!this.fetchImpl) throw new Error("fetch is not available in this environment");

      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: options.model || this.model,
          messages,
          temperature: options.temperature ?? 0,
          response_format: { type: "json_object" }
        })
      });

      this.apiCalls++;

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Mistral API error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      return Utils.safeParseJson(content, {});
    }

    async fillFields({ fields, contextTriples, attrs, instructions = "" }) {
      const prompt = `You are an autofill agent. Fill fields using only the provided user memory.

Fields:
${fields.map((field, index) => `${index + 1}. ${field}`).join("\n")}

Current attributes:
${Object.entries(attrs || {}).map(([key, value]) => `${key}: ${value}`).join("\n")}

Relevant memory:
${(contextTriples || []).map((item) => item.triple?.sentence || item.sentence || String(item)).join("\n")}

${instructions}

Return only JSON:
{
  "filled": {
    "Exact Field Label": "value or UNKNOWN"
  }
}`;

      return this.chatJson([{ role: "user", content: prompt }]);
    }
  }

  const api = Object.freeze({ MistralLLMClient });

  root.AutoFillGraphV3LLM = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
