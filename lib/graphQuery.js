/**
 * GraphQuery - Graph traversal and query engine
 * Provides methods for finding relevant entities and relationships
 */

import { GraphStorage } from './graphStorage.js';

export class GraphQuery {
  /**
   * Breadth-first search from a starting node
   * @param {string} startNodeId - Starting node ID
   * @param {number} maxDepth - Maximum traversal depth
   * @returns {Map} Map of nodeId -> depth reached
   */
  static async bfs(startNodeId, maxDepth = 3) {
    const visited = new Map();
    const queue = [[startNodeId, 0]];
    visited.set(startNodeId, 0);

    while (queue.length > 0) {
      const [nodeId, depth] = queue.shift();
      
      if (depth >= maxDepth) continue;

      const outgoing = await GraphStorage.getOutgoing(nodeId);
      for (const edge of outgoing) {
        if (!visited.has(edge.target)) {
          visited.set(edge.target, depth + 1);
          queue.push([edge.target, depth + 1]);
        }
      }
    }

    return visited;
  }

  /**
   * Find related entities within a depth limit
   * @param {string} nodeId - Starting node ID
   * @param {number} depth - Traversal depth
   * @returns {Array} Array of related node IDs
   */
  static async findRelated(nodeId, depth = 2) {
    const related = new Set();
    const visited = await this.bfs(nodeId, depth);
    
    for (const [relatedId, d] of visited) {
      if (relatedId !== nodeId) {
        related.add(relatedId);
      }
    }

    return Array.from(related);
  }

  /**
   * Get all nodes of specific types
   * @param {Array<string>} types - Array of entity types
   * @returns {Array} Array of nodes
   */
  static async findByTypes(types) {
    const results = [];
    for (const type of types) {
      const nodes = await GraphStorage.getNodesByType(type);
      results.push(...nodes);
    }
    return results;
  }

  /**
   * Search nodes by label with fuzzy matching
   * @param {string} query - Search query
   * @param {number} threshold - Fuzzy match threshold (0-1)
   * @returns {Array} Matching nodes sorted by relevance
   */
  static async search(query, threshold = 0.6) {
    const nodes = await GraphStorage.getAllNodes();
    const results = [];

    for (const node of nodes) {
      const score = this._fuzzyMatch(query.toLowerCase(), node.label.toLowerCase());
      if (score >= threshold) {
        results.push({ node, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).map(r => r.node);
  }

  /**
   * Find nodes connected through specific edge types
   * @param {string} nodeId - Starting node ID
   * @param {Array<string>} edgeTypes - Array of edge types to follow
   * @returns {Array} Array of connected nodes
   */
  static async findByEdgeTypes(nodeId, edgeTypes) {
    const connected = new Set();
    const outgoing = await GraphStorage.getOutgoing(nodeId);

    for (const edge of outgoing) {
      if (edgeTypes.includes(edge.type)) {
        connected.add(edge.target);
      }
    }

    return Array.from(connected);
  }

  /**
   * Get node with all its direct relationships
   * @param {string} nodeId - Node ID
   * @returns {Object} Node with incoming and outgoing edges
   */
  static async getNodeContext(nodeId) {
    const node = await GraphStorage.getNode(nodeId);
    if (!node) return null;

    const outgoing = await GraphStorage.getOutgoing(nodeId);
    const incoming = await GraphStorage.getIncoming(nodeId);

    // Resolve target/source node details
    const outgoingDetails = await Promise.all(
      outgoing.map(async (edge) => ({
        ...edge,
        targetNode: await GraphStorage.getNode(edge.target)
      }))
    );

    const incomingDetails = await Promise.all(
      incoming.map(async (edge) => ({
        ...edge,
        sourceNode: await GraphStorage.getNode(edge.source)
      }))
    );

    return {
      node,
      outgoing: outgoingDetails,
      incoming: incomingDetails
    };
  }

  /**
   * Find shortest path between two nodes
   * @param {string} startId - Start node ID
   * @param {string} endId - End node ID
   * @returns {Array} Path as array of node IDs, or empty if no path
   */
  static async findPath(startId, endId) {
    if (startId === endId) return [startId];

    const queue = [[startId, [startId]]];
    const visited = new Set([startId]);
    const maxDepth = 5;

    while (queue.length > 0) {
      const [nodeId, path] = queue.shift();

      if (path.length > maxDepth) continue;

      const outgoing = await GraphStorage.getOutgoing(nodeId);
      for (const edge of outgoing) {
        if (edge.target === endId) {
          return [...path, endId];
        }

        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push([edge.target, [...path, edge.target]]);
        }
      }
    }

    return [];
  }

  /**
   * Get all skills associated with a role
   * @param {string} roleNodeId - Role node ID
   * @returns {Array} Array of skill nodes
   */
  static async getSkillsForRole(roleNodeId) {
    const skills = await this.findByEdgeTypes(roleNodeId, ['hasSkill', 'usedTechnology']);
    return Promise.all(skills.map(id => GraphStorage.getNode(id)));
  }

  /**
   * Get all roles using a specific skill
   * @param {string} skillNodeId - Skill node ID
   * @returns {Array} Array of role nodes
   */
  static async getRolesForSkill(skillNodeId) {
    const edges = await GraphStorage.getIncoming(skillNodeId);
    const roles = edges
      .filter(e => e.type === 'hasSkill' || e.type === 'usedTechnology')
      .map(e => e.source);
    return Promise.all(roles.map(id => GraphStorage.getNode(id)));
  }

  /**
   * Fuzzy string matching algorithm (Levenshtein-based)
   * @private
   * @param {string} query - Query string
   * @param {string} target - Target string
   * @returns {number} Similarity score (0-1)
   */
  static _fuzzyMatch(query, target) {
    if (target.includes(query)) return 1.0;
    if (query.includes(target)) return 0.9;

    const distance = this._levenshteinDistance(query, target);
    const maxLength = Math.max(query.length, target.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @private
   */
  static _levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
