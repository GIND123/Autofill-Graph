/**
 * GraphStorage - IndexedDB-backed storage for knowledge graph
 * Stores nodes (entities) and edges (relationships)
 */

export class GraphStorage {
  static DB_NAME = 'AutofillGraphDB';
  static DB_VERSION = 1;
  static NODES_STORE = 'nodes';
  static EDGES_STORE = 'edges';
  static db = null;

  /**
   * Initialize the IndexedDB database
   */
  static async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create nodes store with id as primary key
        if (!db.objectStoreNames.contains(this.NODES_STORE)) {
          const nodeStore = db.createObjectStore(this.NODES_STORE, { keyPath: 'id' });
          nodeStore.createIndex('type', 'type', { unique: false });
          nodeStore.createIndex('label', 'label', { unique: false });
        }

        // Create edges store
        if (!db.objectStoreNames.contains(this.EDGES_STORE)) {
          const edgeStore = db.createObjectStore(this.EDGES_STORE, { keyPath: 'id' });
          edgeStore.createIndex('source', 'source', { unique: false });
          edgeStore.createIndex('target', 'target', { unique: false });
          edgeStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  /**
   * Add or update a node in the graph
   * @param {Object} node - Node object with id, type, label, properties, metadata
   */
  static async addNode(node) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.NODES_STORE], 'readwrite');
    const store = tx.objectStore(this.NODES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.put(node);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(node);
    });
  }

  /**
   * Get a node by ID
   * @param {string} nodeId - The node ID
   */
  static async getNode(nodeId) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.NODES_STORE], 'readonly');
    const store = tx.objectStore(this.NODES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(nodeId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all nodes of a specific type
   * @param {string} type - Entity type (e.g., 'skill', 'role', 'org')
   */
  static async getNodesByType(type) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.NODES_STORE], 'readonly');
    const index = tx.objectStore(this.NODES_STORE).index('type');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(type);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Search nodes by label pattern (case-insensitive)
   * @param {string} pattern - Search pattern
   */
  static async searchNodesByLabel(pattern) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.NODES_STORE], 'readonly');
    const store = tx.objectStore(this.NODES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result.filter(node => 
          node.label.toLowerCase().includes(pattern.toLowerCase())
        );
        resolve(results);
      };
    });
  }

  /**
   * Get all nodes
   */
  static async getAllNodes() {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.NODES_STORE], 'readonly');
    const store = tx.objectStore(this.NODES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete a node by ID
   * @param {string} nodeId - The node ID
   */
  static async deleteNode(nodeId) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.NODES_STORE], 'readwrite');
    const store = tx.objectStore(this.NODES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(nodeId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Add or update an edge (relationship) in the graph
   * @param {Object} edge - Edge object with id, source, target, type, properties, metadata
   */
  static async addEdge(edge) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.EDGES_STORE], 'readwrite');
    const store = tx.objectStore(this.EDGES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.put(edge);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(edge);
    });
  }

  /**
   * Get an edge by ID
   * @param {string} edgeId - The edge ID
   */
  static async getEdge(edgeId) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.EDGES_STORE], 'readonly');
    const store = tx.objectStore(this.EDGES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(edgeId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all edges from a source node
   * @param {string} sourceId - Source node ID
   */
  static async getOutgoing(sourceId) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.EDGES_STORE], 'readonly');
    const index = tx.objectStore(this.EDGES_STORE).index('source');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(sourceId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all edges to a target node
   * @param {string} targetId - Target node ID
   */
  static async getIncoming(targetId) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.EDGES_STORE], 'readonly');
    const index = tx.objectStore(this.EDGES_STORE).index('target');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(targetId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all edges of a specific type
   * @param {string} type - Edge type (e.g., 'hasSkill', 'workedAt')
   */
  static async getEdgesByType(type) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.EDGES_STORE], 'readonly');
    const index = tx.objectStore(this.EDGES_STORE).index('type');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(type);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all edges
   */
  static async getAllEdges() {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.EDGES_STORE], 'readonly');
    const store = tx.objectStore(this.EDGES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete an edge by ID
   * @param {string} edgeId - The edge ID
   */
  static async deleteEdge(edgeId) {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.EDGES_STORE], 'readwrite');
    const store = tx.objectStore(this.EDGES_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(edgeId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get full graph context as JSON
   */
  static async getFullContext() {
    const nodes = await this.getAllNodes();
    const edges = await this.getAllEdges();
    return {
      nodes,
      edges,
      timestamp: Date.now()
    };
  }

  /**
   * Clear all data from the database
   */
  static async clear() {
    if (!this.db) await this.init();
    
    const tx = this.db.transaction([this.NODES_STORE, this.EDGES_STORE], 'readwrite');
    
    return new Promise((resolve, reject) => {
      const nodesClear = tx.objectStore(this.NODES_STORE).clear();
      const edgesClear = tx.objectStore(this.EDGES_STORE).clear();
      
      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 2) resolve();
      };
      
      nodesClear.onerror = () => reject(nodesClear.error);
      nodesClear.onsuccess = checkComplete;
      
      edgesClear.onerror = () => reject(edgesClear.error);
      edgesClear.onsuccess = checkComplete;
    });
  }
}
