// AutoFillGraph v5 — Content Script (content_v5.js)
// Form detection, field extraction, autofill injection, and learning.
"use strict";

(function AutoFillGraphV5Content() {

  // ── Constants ─────────────────────────────────────────────────────────────

  const AUTOFILLABLE_TYPES = new Set([
    "text", "email", "tel", "url", "number", "search",
    "date", "time", "month", "week", "password", ""
  ]);

  const SKIP_NAMES = new Set([
    "password", "confirm_password", "new_password",
    "captcha", "csrf", "token", "_token", "g-recaptcha-response"
  ]);

  // ── Field extraction ──────────────────────────────────────────────────────

  function extractFields() {
    const fields = [];
    const seen   = new Set();

    for (const form of document.querySelectorAll("form, [data-form], main")) {
      for (const el of form.querySelectorAll("input, textarea, select")) {
        if (!_isAutofillable(el)) continue;
        const label = _resolveLabel(el);
        if (!label) continue;
        const id = label.toLowerCase().trim();
        if (seen.has(id)) continue;
        seen.add(id);
        fields.push({ label, element: el, value: el.value || "" });
      }
    }
    return fields;
  }

  function _isAutofillable(el) {
    if (el.disabled || el.readOnly) return false;
    if (el.type === "hidden" || el.type === "submit" || el.type === "button" ||
        el.type === "reset"  || el.type === "image"  || el.type === "file") return false;
    if (!AUTOFILLABLE_TYPES.has(el.type)) return false;
    const name = (el.name || el.id || "").toLowerCase();
    if (SKIP_NAMES.has(name)) return false;
    return true;
  }

  function _resolveLabel(el) {
    // 1. explicit <label for="...">
    const id = el.id;
    if (id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lbl) return lbl.innerText.trim();
    }
    // 2. wrapping <label>
    const parent = el.closest("label");
    if (parent) return parent.innerText.replace(el.value, "").trim();

    // 3. aria-label / aria-labelledby
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim();
    const lblId = el.getAttribute("aria-labelledby");
    if (lblId) {
      const lblEl = document.getElementById(lblId);
      if (lblEl) return lblEl.innerText.trim();
    }

    // 4. placeholder
    if (el.placeholder) return el.placeholder.trim();

    // 5. name / id as last resort
    return (el.name || el.id || "").replace(/[_\-]/g, " ").trim() || null;
  }

  // ── Inject autofill values into form fields ───────────────────────────────

  function injectValues(filled, meta) {
    const fieldsList = extractFields();
    let count = 0;

    for (const { label, element } of fieldsList) {
      const value = filled[label];
      if (!value || value === "UNKNOWN") continue;
      const m = meta?.[label] || {};

      _setNativeValue(element, String(value));

      // Visual badge
      const conf = m.confidence || 0;
      _attachBadge(element, m.status || "FILLED", conf, m.route || "local");
      count++;
    }
    return count;
  }

  function _setNativeValue(el, value) {
    // React / Vue compatibility: dispatch native input + change events
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el.tagName === "SELECT" ? HTMLSelectElement.prototype :
      el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype :
      HTMLInputElement.prototype, "value"
    )?.set;

    if (nativeSetter) nativeSetter.call(el, value);
    else el.value = value;

    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function _attachBadge(el, status, confidence, route) {
    const existing = el.parentElement?.querySelector(".afg-v5-badge");
    if (existing) existing.remove();

    const colors = {
      FILLED: "#2563eb", INFERRED: "#0891b2", GENERATED: "#7c3aed",
      UNKNOWN: "#94a3b8", IMAGE_FILLED: "#059669", NOT_APPLICABLE: "#94a3b8"
    };
    const badge = document.createElement("span");
    badge.className = "afg-v5-badge";
    badge.title  = `AFG v5 • ${status} via ${route} (conf: ${Math.round(confidence * 100)}%)`;
    badge.style.cssText = [
      "position:absolute", "top:2px", "right:4px",
      "font-size:10px", "padding:1px 5px",
      `background:${colors[status] || "#64748b"}`,
      "color:#fff", "border-radius:3px",
      "pointer-events:none", "z-index:99999",
      "font-family:monospace"
    ].join(";");
    badge.textContent = `AFG:${status.slice(0, 3)}`;

    const wrapper = el.parentElement;
    if (wrapper) {
      const pos = getComputedStyle(wrapper).position;
      if (pos === "static") wrapper.style.position = "relative";
      wrapper.appendChild(badge);
    }
  }

  // ── Collect form values for learning ──────────────────────────────────────

  function collectFormValues() {
    const form = {};
    for (const { label, element } of extractFields()) {
      const v = element.value?.trim();
      if (v) form[label] = v;
    }
    return form;
  }

  // ── Message listener (from background / popup) ────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.action === "DETECT_FIELDS") {
        const fields = extractFields().map(f => f.label);
        sendResponse({ ok: true, fields, count: fields.length, domain: _detectDomain() });
      } else if (msg.action === "INJECT_AUTOFILL") {
        const count = injectValues(msg.filled, msg.meta);
        sendResponse({ ok: true, count });
      } else if (msg.action === "COLLECT_FORM") {
        sendResponse({ ok: true, form: collectFormValues() });
      } else {
        sendResponse({ error: "Unknown content action: " + msg.action });
      }
    } catch (err) {
      sendResponse({ error: String(err) });
    }
    return true;
  });

  // ── Domain detection from URL ─────────────────────────────────────────────

  function _detectDomain() {
    const url = location.href.toLowerCase();
    if (/visa|immigration|passport/.test(url))    return "visa";
    if (/medical|health|patient|hospital/.test(url)) return "medical";
    if (/bank|finance|tax|payment/.test(url))     return "financial";
    if (/academic|university|admission|edu/.test(url)) return "academic";
    if (/job|career|recruit|apply|linkedin/.test(url)) return "job";
    return "general";
  }

})();
