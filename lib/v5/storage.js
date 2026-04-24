(function initAutoFillGraphV5Storage(root) {
  "use strict";

  const Utils = root.AutoFillGraphV5Utils;

  if (!Utils) throw new Error("Load utils.js before storage.js");

  // ── StorageManager ────────────────────────────────────────────────────────
  // Chrome.storage.local persistence for AutoFillGraph v5.
  // Stores the full agent serialisation under key "afg_v5".

  const STORAGE_KEY = "afg_v5";

  class StorageManager {
    constructor(key = STORAGE_KEY) {
      this.key = key;
    }

    async save(data) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [this.key]: data }, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
    }

    async load() {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(this.key, (result) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(result[this.key] || null);
        });
      });
    }

    async clear() {
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove(this.key, () => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      });
    }

    async getStorageUsage() {
      return new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(this.key, (bytes) => {
          resolve({ bytes, kb: Math.round(bytes / 1024 * 10) / 10 });
        });
      });
    }
  }

  const api = Object.freeze({ StorageManager, STORAGE_KEY });

  root.AutoFillGraphV5Storage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
