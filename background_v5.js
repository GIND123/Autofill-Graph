// AutoFillGraph v5 — Service Worker (background_v5.js)
// Manages agent lifecycle, Chrome storage persistence, and message routing.
"use strict";

// Load all v5 library modules (IIFE pattern via importScripts)
importScripts(
  "lib/v5/utils.js",
  "lib/v5/schema.js",
  "lib/v5/temporalKG.js",
  "lib/v5/memory.js",
  "lib/v5/consolidator.js",
  "lib/v5/fieldMapper.js",
  "lib/v5/router.js",
  "lib/v5/retriever.js",
  "lib/v5/inferenceEngine.js",
  "lib/v5/compositionalResolver.js",
  "lib/v5/llmClient.js",
  "lib/v5/narrator.js",
  "lib/v5/ocr.js",
  "lib/v5/storage.js",
  "lib/v5/autoFillAgentV5.js",
  "lib/v5/index.js"
);

// ── Agent singleton (initialised lazily) ────────────────────────────────────

let _agent = null;
let _apiKey = "";
let _initialised = false;

// ── Initialise / restore agent from Chrome storage ───────────────────────────

async function ensureAgent() {
  if (_initialised && _agent) return _agent;

  // Load API key from sync storage
  const cfg = await chrome.storage.sync.get(["apiKey", "mistralModel"]).catch(() => ({}));
  _apiKey = cfg.apiKey || "";

  // Create agent
  const { AutoFillAgentV5 } = globalThis.AutoFillGraphV5;
  const { MistralClient }   = globalThis.AutoFillGraphV5;

  const llm = new MistralClient({ apiKey: _apiKey, model: cfg.mistralModel || "mistral-small-latest" });

  // Try loading persisted data
  const { StorageManager } = globalThis.AutoFillGraphV5;
  const storage = new StorageManager();
  const saved = await storage.load().catch(() => null);

  if (saved) {
    _agent = AutoFillAgentV5.deserialize(saved, { llm });
    console.info("[AFG-v5] Agent restored from storage:", _agent.stats());
  } else {
    _agent = new AutoFillAgentV5({ llm });
    console.info("[AFG-v5] New agent initialised");
  }

  _initialised = true;
  return _agent;
}

// ── Persist agent to Chrome storage ────────────────────────────────────────

async function persistAgent() {
  if (!_agent) return;
  const { StorageManager } = globalThis.AutoFillGraphV5;
  const storage = new StorageManager();
  await storage.save(_agent.serialize()).catch(err => console.warn("[AFG-v5] persist failed:", err));
}

// ── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch(err => {
    console.error("[AFG-v5] message error:", err);
    sendResponse({ error: String(err) });
  });
  return true; // keep channel open for async
});

async function handleMessage(msg) {
  const agent = await ensureAgent();

  switch (msg.action) {

    // ── Learn from filled form ───────────────────────────────────────────
    case "LEARN": {
      const result = agent.learn(msg.form, msg.context || "human");
      await persistAgent();
      return { ok: true, ...result };
    }

    // ── Autofill a list of fields ────────────────────────────────────────
    case "AUTOFILL": {
      const episode = await agent.autofill(msg.fields, msg.domain || "general", msg.useLlm !== false);
      const filled  = {};
      const meta    = {};
      for (const [field, result] of Object.entries(episode.results)) {
        filled[field] = result.value;
        meta[field]   = result.toJSON();
      }
      return { ok: true, filled, meta, episodeId: episode.id };
    }

    // ── Process user feedback ────────────────────────────────────────────
    case "FEEDBACK": {
      const episode = _rebuildEpisode(msg.episode);
      agent.feedback(episode, msg.feedback);
      await persistAgent();
      return { ok: true };
    }

    // ── Long-form QA ─────────────────────────────────────────────────────
    case "ANSWER_QUESTION": {
      const { answer, context } = await agent.answerQuestion(msg.question, msg.maxWords || 60);
      return { ok: true, answer, context };
    }

    // ── Update API key ───────────────────────────────────────────────────
    case "SET_API_KEY": {
      await chrome.storage.sync.set({ apiKey: msg.apiKey });
      _apiKey = msg.apiKey;
      agent.llm.apiKey  = msg.apiKey;
      agent.llm._ready  = Boolean(msg.apiKey);
      const ok = msg.apiKey ? await agent.llm.test() : false;
      return { ok };
    }

    // ── Get agent statistics ─────────────────────────────────────────────
    case "GET_STATS": {
      return { ok: true, stats: agent.stats() };
    }

    // ── Get current KG snapshot ──────────────────────────────────────────
    case "GET_GRAPH_DATA": {
      const cur  = agent.kg.current(
        globalThis.AutoFillGraphV5.Schema.Sensitivity.ENCRYPTED
      );
      const hist = {};
      for (const [prop, vals] of agent.kg._attrs.entries()) {
        hist[prop] = vals.map(a => ({
          value: String(a.value), valid_from: a.valid_from, valid_until: a.valid_until,
          confidence: Math.round(a.confidence * 1000) / 1000,
          source: a.source, current: a.is_current()
        }));
      }
      return {
        ok: true,
        current: cur,
        history: hist,
        stats: agent.kg.graphStats(),
        entities: Array.from(agent.kg._nodes.entries())
          .filter(([id]) => id !== "user")
          .map(([id, node]) => ({ id, ...node }))
      };
    }

    // ── Clear all data ───────────────────────────────────────────────────
    case "CLEAR_GRAPH": {
      const { StorageManager } = globalThis.AutoFillGraphV5;
      await new StorageManager().clear();
      const llm = agent.llm;
      const { AutoFillAgentV5 } = globalThis.AutoFillGraphV5;
      _agent = new AutoFillAgentV5({ llm });
      _initialised = true;
      return { ok: true };
    }

    // ── Export graph as JSON ─────────────────────────────────────────────
    case "EXPORT": {
      return { ok: true, data: agent.serialize() };
    }

    // ── Import graph from JSON ───────────────────────────────────────────
    case "IMPORT": {
      const llm = agent.llm;
      const { AutoFillAgentV5 } = globalThis.AutoFillGraphV5;
      _agent = AutoFillAgentV5.deserialize(msg.data, { llm });
      await persistAgent();
      return { ok: true, stats: _agent.stats() };
    }

    // ── Ping ─────────────────────────────────────────────────────────────
    case "PING":
      return { ok: true, version: "5.0.0", stats: agent.stats() };

    default:
      return { error: `Unknown action: ${msg.action}` };
  }
}

// ── Rebuild a FillEpisode from serialised data ────────────────────────────

function _rebuildEpisode(data) {
  if (!data) return null;
  const { FillEpisode, FillResult } = globalThis.AutoFillGraphV5;
  const schema = globalThis.AutoFillGraphV5.Schema;
  const results = {};
  for (const [field, r] of Object.entries(data.results || {})) {
    results[field] = new FillResult(field, {
      prop: r.prop, value: r.value,
      status: r.status || schema.FillStatus.UNKNOWN,
      route: r.route, confidence: r.confidence || 0,
      evidence: r.evidence || [], reason: r.reason || ""
    });
  }
  return new FillEpisode({
    id: data.id, domain: data.domain, fields: data.fields,
    results, feedback: data.feedback || {}, created_at: data.created_at
  });
}

// ── Service worker install / activate ────────────────────────────────────

self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));

console.info("[AFG-v5] Service worker loaded (v5.0.0)");
