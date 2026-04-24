// AutoFillGraph v5 — Popup UI Logic (popup_v5.js)
"use strict";

// ── Helpers ──────────────────────────────────────────────────────────────────

function msg(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

async function withActiveTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  return fn(tab.id);
}

async function sendToContent(tabId, action, data = {}) {
  return chrome.tabs.sendMessage(tabId, { action, ...data });
}

let _toast;
function toast(text, duration = 2200) {
  if (!_toast) _toast = document.getElementById("toast");
  _toast.textContent = text;
  _toast.classList.add("show");
  clearTimeout(_toast._timer);
  _toast._timer = setTimeout(() => _toast.classList.remove("show"), duration);
}

function spin(id, on) {
  const el = document.getElementById(id);
  if (el) el.style.display = on ? "inline-block" : "none";
}

function setStatus(text, cls = "") {
  const el = document.getElementById("status-text");
  if (!el) return;
  el.textContent = text;
  el.className   = "status-val" + (cls ? ` ${cls}` : "");
}

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add("active");

    if (tab.dataset.tab === "insights") renderInsights();
    if (tab.dataset.tab === "graph")    renderGraph();
    if (tab.dataset.tab === "settings") renderSettings();
  });
});

// ── Detect fields ─────────────────────────────────────────────────────────────

document.getElementById("btn-detect").addEventListener("click", async () => {
  spin("detect-spin", true);
  try {
    const res = await withActiveTab(id => sendToContent(id, "DETECT_FIELDS"));
    document.getElementById("fields-count").textContent = `${res.count || 0} fields`;
    setStatus("Fields detected", "ok");
    toast(`${res.count} fields found on page`);
  } catch (err) {
    setStatus("Error", "err");
    toast("Content script error — refresh the page");
  } finally {
    spin("detect-spin", false);
  }
});

// ── Autofill ──────────────────────────────────────────────────────────────────

document.getElementById("btn-autofill").addEventListener("click", async () => {
  spin("fill-spin", true);
  setStatus("Filling…");
  try {
    // Detect current fields
    const { fields, domain } = await withActiveTab(id =>
      sendToContent(id, "DETECT_FIELDS")
    );
    if (!fields?.length) { toast("No fields detected"); return; }

    // Ask background to autofill
    const { filled, meta, episodeId } = await msg("AUTOFILL", { fields, domain });

    // Inject into page
    const count = await withActiveTab(id =>
      sendToContent(id, "INJECT_AUTOFILL", { filled, meta })
    );

    const total = fields.length;
    const done  = Object.values(filled).filter(v => v && v !== "UNKNOWN").length;
    setStatus(`${done}/${total} filled`, "ok");
    document.getElementById("last-fill").textContent =
      `${done}/${total} · ep ${episodeId}`;
    toast(`Filled ${done} of ${total} fields`);
    await refreshQuickStats();
  } catch (err) {
    setStatus("Error", "err");
    toast("Autofill failed — see console");
    console.error("[AFG-v5 popup]", err);
  } finally {
    spin("fill-spin", false);
  }
});

// ── Learn ─────────────────────────────────────────────────────────────────────

document.getElementById("btn-learn").addEventListener("click", async () => {
  setStatus("Learning…");
  try {
    const form = await withActiveTab(id => sendToContent(id, "COLLECT_FORM"));
    if (!form || !Object.keys(form).length) {
      toast("No filled fields to learn from");
      setStatus("Nothing to learn");
      return;
    }
    const { learned, inferred } = await msg("LEARN", { form });
    setStatus(`Learned ${learned.length} props`, "ok");
    toast(`Learned ${learned.length} props, inferred ${inferred.length}`);
    await refreshQuickStats();
  } catch (err) {
    setStatus("Error", "err");
    toast("Learn failed");
  }
});

// ── Export ────────────────────────────────────────────────────────────────────

document.getElementById("btn-export").addEventListener("click", async () => {
  try {
    const { data } = await msg("EXPORT");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `afg-v5-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Graph exported");
  } catch (err) { toast("Export failed"); }
});

// ── Clear ─────────────────────────────────────────────────────────────────────

document.getElementById("btn-clear").addEventListener("click", async () => {
  if (!confirm("Clear all graph data? This cannot be undone.")) return;
  await msg("CLEAR_GRAPH");
  toast("Graph cleared");
  await refreshQuickStats();
  renderGraph();
});

// ── Save API key ──────────────────────────────────────────────────────────────

document.getElementById("btn-save-key").addEventListener("click", async () => {
  const key   = document.getElementById("api-key").value.trim();
  const model = document.getElementById("model-select").value;
  await chrome.storage.sync.set({ mistralModel: model });
  const { ok } = await msg("SET_API_KEY", { apiKey: key });
  document.getElementById("api-status").textContent = ok ? "Connected" : "Failed";
  document.getElementById("api-status").className =
    "status-val " + (ok ? "ok" : "err");
  toast(ok ? "API key saved and tested ✓" : "API key test failed");
});

// ── Refresh quick stats ───────────────────────────────────────────────────────

async function refreshQuickStats() {
  try {
    const { stats } = await msg("GET_STATS");
    document.getElementById("stat-facts").textContent     = stats.current_facts ?? "—";
    document.getElementById("stat-episodes").textContent  = stats.epi?.episodes ?? "—";
    document.getElementById("stat-retriever").textContent = stats.retriever ?? "—";
    document.getElementById("stat-llm-calls").textContent = stats.llm_calls ?? "—";

    // Bandit
    const b = stats.bandit || {};
    const banditEl = document.getElementById("bandit-summary");
    banditEl.innerHTML = [
      _banditRow("Decisions", b.decisions ?? "—"),
      _banditRow("Epsilon (exploration)", b.epsilon ?? "—"),
      _banditRow("Local (arm 0)", b.arm0_local ?? "—"),
      _banditRow("LLM small (arm 1)", b.arm1_llm ?? "—"),
      _banditRow("Avg reward", b.avg_reward ?? "—"),
    ].join("");
  } catch (_) {}
}

function _banditRow(label, val) {
  return `<div class="bandit-row">
    <span class="bandit-label">${label}</span>
    <span class="bandit-val">${val}</span>
  </div>`;
}

// ── Insights panel ────────────────────────────────────────────────────────────

async function renderInsights() {
  const { current, history, stats } = await msg("GET_GRAPH_DATA");

  // Current knowledge
  const list = document.getElementById("insights-list");
  const entries = Object.entries(current || {});
  if (!entries.length) {
    list.innerHTML = '<div class="empty">No knowledge stored yet</div>';
  } else {
    list.innerHTML = entries.map(([prop, val]) => {
      const short = String(val).length > 60 ? String(val).slice(0, 60) + "…" : String(val);
      return `<div class="history-item">
        <div class="history-prop">${_formatProp(prop)}</div>
        <div class="history-entry history-active">${_esc(short)}</div>
      </div>`;
    }).join("");
  }

  // Temporal history
  const hist = document.getElementById("history-list");
  const histEntries = Object.entries(history || {}).filter(([, vals]) => vals.length > 1);
  if (!histEntries.length) {
    hist.innerHTML = '<div class="empty">No temporal changes yet</div>';
  } else {
    hist.innerHTML = histEntries.map(([prop, vals]) => {
      const rows = vals.slice(-4).reverse().map(v => {
        const cls   = v.current ? "history-active" : "history-exp";
        const ts    = v.valid_from?.slice(0, 16).replace("T", " ") || "";
        const src   = v.source?.includes("inferred") ? " [inferred]" : "";
        return `<div class="history-entry ${cls}">
          ${_esc(String(v.value).slice(0, 40))}${src}
          <small style="color:var(--c-muted)"> @ ${ts}</small>
        </div>`;
      }).join("");
      return `<div class="history-item">
        <div class="history-prop">${_formatProp(prop)}</div>${rows}
      </div>`;
    }).join("");
  }

  // Sensitivity
  const total = Object.keys(current || {}).length;
  const allHistory = Object.keys(history || {});
  const sens = { PUBLIC: 0, RESTRICTED: 0, ENCRYPTED: 0 };
  for (const prop of Object.keys(current || {})) {
    // Infer layer from name
    if (["ssn","tax_id","bank_name","annual_income","credit_score",
         "allergies","blood_type","insurance_id","conditions","medications",
         "primary_care","profile_photo","signature","resume_scan",
         "transcript_scan","id_scan"].includes(prop)) sens.RESTRICTED++;
    else if (["passport_number","visa_status","drivers_license","citizenship"].includes(prop)) sens.ENCRYPTED++;
    else sens.PUBLIC++;
  }
  const sensEl = document.getElementById("sens-breakdown");
  sensEl.innerHTML = `
    <div class="status-row"><span class="status-label">Public</span><span style="color:var(--c-green)">${sens.PUBLIC}</span></div>
    <div class="status-row"><span class="status-label">Restricted</span><span style="color:var(--c-amber)">${sens.RESTRICTED}</span></div>
    <div class="status-row"><span class="status-label">Encrypted</span><span style="color:var(--c-red)">${sens.ENCRYPTED}</span></div>
    <div class="sens-bar" style="margin-top:6px">
      ${total ? `<div class="sens-seg filled" style="flex:${sens.PUBLIC}"></div>` : ""}
      ${total ? `<div class="sens-seg restricted" style="flex:${sens.RESTRICTED}"></div>` : ""}
      ${total ? `<div class="sens-seg encrypted" style="flex:${sens.ENCRYPTED}"></div>` : ""}
    </div>`;
}

// ── Graph panel ───────────────────────────────────────────────────────────────

async function renderGraph() {
  const { current, entities, stats } = await msg("GET_GRAPH_DATA");
  const nodeEl = document.getElementById("graph-nodes");
  const entEl  = document.getElementById("graph-entities");

  const props = Object.keys(current || {});
  if (!props.length) {
    nodeEl.innerHTML = '<div class="empty">No property nodes</div>';
  } else {
    nodeEl.innerHTML = props.slice(0, 20).map(p => {
      const val = String(current[p] || "").slice(0, 45);
      return `<div class="node-row">
        <span class="node-type-badge">PROP</span>
        <span style="flex:1">${_formatProp(p)}</span>
        <span style="color:var(--c-muted);font-size:10px">${_esc(val)}</span>
      </div>`;
    }).join("") + (props.length > 20 ? `<div class="empty">…and ${props.length - 20} more</div>` : "");
  }

  if (!entities?.length) {
    entEl.innerHTML = '<div class="empty">No entity nodes</div>';
  } else {
    entEl.innerHTML = entities.slice(0, 15).map(e => `<div class="node-row">
      <span class="node-type-badge">${(e.type || "ORG").slice(0, 3).toUpperCase()}</span>
      <span>${_esc(e.label || e.id)}</span>
    </div>`).join("");
  }
}

// ── Settings panel ────────────────────────────────────────────────────────────

async function renderSettings() {
  const cfg = await chrome.storage.sync.get(["apiKey", "mistralModel"]).catch(() => ({}));
  if (cfg.apiKey) document.getElementById("api-key").value = cfg.apiKey;
  if (cfg.mistralModel) document.getElementById("model-select").value = cfg.mistralModel;

  const { stats } = await msg("GET_STATS").catch(() => ({ stats: {} }));
  const st = stats || {};
  document.getElementById("api-status").textContent = st.llm_calls > 0 ? "Active" : "—";
  document.getElementById("tokens-used").textContent = st.llm_tokens ?? "—";

  // Privacy breakdown
  const { current } = await msg("GET_GRAPH_DATA").catch(() => ({ current: {} }));
  const privEl = document.getElementById("privacy-breakdown");
  const total  = Object.keys(current || {}).length;
  privEl.innerHTML = `
    <div class="status-row"><span class="status-label">Total facts stored</span><span class="status-val">${total}</span></div>
    <div class="status-row" style="margin-top:4px"><span class="status-label">Storage engine</span><span class="status-val">Chrome.storage.local</span></div>
    <div class="status-row" style="margin-top:4px"><span class="status-label">Encrypted props</span><span class="status-val" style="color:var(--c-red)">Never leave device</span></div>`;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function _formatProp(p) {
  return p.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function _esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
  await refreshQuickStats();
})();
