(function initAutoFillGraphV3Storage(root) {
  "use strict";

  class ChromeLocalStorageAdapter {
    constructor(prefix = "autofillGraphV3") {
      this.prefix = prefix;
    }

    key(name) {
      return `${this.prefix}:${name}`;
    }

    async get(name, fallback = null) {
      if (!root.chrome?.storage?.local) return fallback;
      const result = await root.chrome.storage.local.get(this.key(name));
      return result[this.key(name)] ?? fallback;
    }

    async set(name, value) {
      if (!root.chrome?.storage?.local) throw new Error("chrome.storage.local is unavailable");
      await root.chrome.storage.local.set({ [this.key(name)]: value });
    }

    async remove(name) {
      if (!root.chrome?.storage?.local) return;
      await root.chrome.storage.local.remove(this.key(name));
    }
  }

  class IndexedDBStorageAdapter {
    constructor(options = {}) {
      this.dbName = options.dbName || "AutoFillGraphV3";
      this.version = options.version || 1;
      this.storeName = options.storeName || "kv";
    }

    async open() {
      if (!root.indexedDB) throw new Error("IndexedDB is unavailable");
      return new Promise((resolve, reject) => {
        const request = root.indexedDB.open(this.dbName, this.version);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async get(name, fallback = null) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readonly");
        const request = tx.objectStore(this.storeName).get(name);
        request.onsuccess = () => resolve(request.result ?? fallback);
        request.onerror = () => reject(request.error);
      });
    }

    async set(name, value) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readwrite");
        tx.objectStore(this.storeName).put(value, name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    async remove(name) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readwrite");
        tx.objectStore(this.storeName).delete(name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  const api = Object.freeze({
    ChromeLocalStorageAdapter,
    IndexedDBStorageAdapter
  });

  root.AutoFillGraphV3Storage = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
