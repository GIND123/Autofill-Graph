(function initAutoFillGraphV5LLMClient(root) {
  "use strict";

  const Utils = root.AutoFillGraphV5Utils;

  if (!Utils) throw new Error("Load utils.js before llmClient.js");

  // ── MistralClient ─────────────────────────────────────────────────────────
  // Mirrors Prototype5 MistralClient with:
  //   chat_json(prompt, system) → object   (JSON response_format)
  //   chat_text(prompt, system) → string   (plain text)
  //   available()               → bool
  //   test()                    → bool

  const DEFAULT_MODEL    = "mistral-small-latest";
  const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

  class MistralClient {
    constructor(options = {}) {
      this.apiKey     = options.apiKey || options.api_key || "";
      this.model      = options.model  || DEFAULT_MODEL;
      this.endpoint   = MISTRAL_ENDPOINT;
      this.calls      = 0;
      this.tokensUsed = 0;
      this.lastError  = null;
      this._ready     = Boolean(this.apiKey);
    }

    available() { return Boolean(this.apiKey) && this._ready; }

    // ── Internal POST ─────────────────────────────────────────────────────

    async _post(messages, jsonMode = true) {
      const payload = { model: this.model, messages, temperature: 0 };
      if (jsonMode) payload.response_format = { type: "json_object" };

      try {
        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        this.calls++;
        if (!res.ok) {
          const err = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
        }
        const data = await res.json();
        this.tokensUsed += (data.usage?.total_tokens || 0);
        return data.choices?.[0]?.message?.content || (jsonMode ? "{}" : "");
      } catch (err) {
        this.lastError = String(err);
        this._ready = false;
        return jsonMode ? "{}" : "";
      }
    }

    // ── JSON mode ─────────────────────────────────────────────────────────

    async chatJson(prompt, system = "") {
      const messages = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });
      const raw = await this._post(messages, true);
      return Utils.safeParseJson(raw, {});
    }

    // ── Text mode ─────────────────────────────────────────────────────────

    async chatText(prompt, system = "") {
      const messages = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: prompt });
      const raw = await this._post(messages, false);
      return String(raw).trim();
    }

    // ── Connectivity test ─────────────────────────────────────────────────

    async test() {
      const res = await this.chatJson('Return {"ok": true}');
      const ok = res?.ok === true;
      this._ready = ok;
      return ok;
    }

    stats() {
      return { calls: this.calls, tokensUsed: this.tokensUsed, lastError: this.lastError };
    }
  }

  const api = Object.freeze({ MistralClient, DEFAULT_MODEL });

  root.AutoFillGraphV5LLMClient = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
