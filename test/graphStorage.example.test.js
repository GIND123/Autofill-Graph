import { GraphStorage } from '../lib/graphStorage.js';

/**
 * Unit tests for GraphStorage module
 * Tests database initialization, CRUD operations, and search functionality
 */

describe('GraphStorage - Database Operations', () => {
  /**
   * Initialize fresh database before each test
   */
  beforeEach(async () => {
    // Note: In real testing environment, use a test database
    // This opens/creates AutofillGraphDB in IndexedDB
    await GraphStorage.init();
    await GraphStorage.clear();
  });

  describe('Node Operations', () => {
    test('should create and retrieve a node by ID', async () => {
      const testNode = {
        id: 'skill-javascript',
        type: 'skill',
        label: 'JavaScript',
        properties: {
          category: 'programming',
          level: 'expert'
        },
        metadata: {
          createdAt: Date.now(),
          confidence: 0.95,
          source: 'resume'
        }
      };

      // Add node to graph
      await GraphStorage.addNode(testNode);

      // Retrieve and verify
      const retrieved = await GraphStorage.getNode('skill-javascript');
      expect(retrieved).toBeDefined();
      expect(retrieved.label).toBe('JavaScript');
      expect(retrieved.properties.category).toBe('programming');
      expect(retrieved.metadata.confidence).toBe(0.95);
    });

    test('should search nodes by label with partial matching', async () => {
      const nodes = [
        {
          id: 'skill-1',
          type: 'skill',
          label: 'JavaScript',
          properties: {},
          metadata: { createdAt: Date.now(), confidence: 1.0 }
        },
        {
          id: 'skill-2',
          type: 'skill',
          label: 'TypeScript',
          properties: {},
          metadata: { createdAt: Date.now(), confidence: 1.0 }
        },
        {
          id: 'skill-3',
          type: 'skill',
          label: 'Python',
          properties: {},
          metadata: { createdAt: Date.now(), confidence: 1.0 }
        }
      ];

      // Add all nodes
      for (const node of nodes) {
        await GraphStorage.addNode(node);
      }

      // Search for "Script" - should match JavaScript and TypeScript
      const results = await GraphStorage.searchNodesByLabel('Script');
      expect(results.length).toBe(2);
      expect(results.map(n => n.id)).toContain('skill-1');
      expect(results.map(n => n.id)).toContain('skill-2');
    });

    test('should retrieve all nodes of a specific type', async () => {
      const nodes = [
        {
          id: 'skill-1',
          type: 'skill',
          label: 'React',
          properties: {},
          metadata: { createdAt: Date.now(), confidence: 1.0 }
        },
        {
          id: 'skill-2',
          type: 'skill',
          label: 'Vue',
          properties: {},
          metadata: { createdAt: Date.now(), confidence: 1.0 }
        },
        {
          id: 'role-1',
          type: 'role',
          label: 'Senior Developer',
          properties: {},
          metadata: { createdAt: Date.now(), confidence: 1.0 }
        }
      ];

      for (const node of nodes) {
        await GraphStorage.addNode(node);
      }

      // Query all skills
      const skills = await GraphStorage.getNodesByType('skill');
      expect(skills.length).toBe(2);
      expect(skills.every(n => n.type === 'skill')).toBe(true);

      // Query all roles
      const roles = await GraphStorage.getNodesByType('role');
      expect(roles.length).toBe(1);
    });

    test('should update node properties', async () => {
      const node = {
        id: 'skill-1',
        type: 'skill',
        label: 'React',
        properties: { version: '16' },
        metadata: { createdAt: Date.now(), confidence: 0.8 }
      };

      await GraphStorage.addNode(node);

      // Update confidence
      const updated = { ...node, metadata: { ...node.metadata, confidence: 0.95 } };
      await GraphStorage.addNode(updated);

      const retrieved = await GraphStorage.getNode('skill-1');
      expect(retrieved.metadata.confidence).toBe(0.95);
    });

    test('should delete a node', async () => {
      const node = {
        id: 'skill-to-delete',
        type: 'skill',
        label: 'Outdated',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };

      await GraphStorage.addNode(node);
      await GraphStorage.deleteNode('skill-to-delete');

      const retrieved = await GraphStorage.getNode('skill-to-delete');
      expect(retrieved).toBeNull();
    });
  });

  describe('Edge Operations', () => {
    test('should create relationship between nodes', async () => {
      // Setup: create two nodes
      const role = {
        id: 'role-1',
        type: 'role',
        label: 'Senior Developer',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };
      const skill = {
        id: 'skill-1',
        type: 'skill',
        label: 'JavaScript',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };

      await GraphStorage.addNode(role);
      await GraphStorage.addNode(skill);

      // Create relationship
      const edge = {
        id: 'edge-role-skill',
        source: 'role-1',
        target: 'skill-1',
        type: 'hasSkill',
        properties: { weight: 1.0 },
        metadata: { inferred: false, confidence: 1.0 }
      };

      await GraphStorage.addEdge(edge);

      // Verify relationship
      const outgoing = await GraphStorage.getOutgoing('role-1');
      expect(outgoing.length).toBe(1);
      expect(outgoing[0].type).toBe('hasSkill');
      expect(outgoing[0].target).toBe('skill-1');
    });

    test('should query incoming relationships', async () => {
      // Setup graph chain: Role -> Skill -> Tech
      const role = {
        id: 'role-1',
        type: 'role',
        label: 'Developer',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };
      const skill = {
        id: 'skill-1',
        type: 'skill',
        label: 'JavaScript',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };

      await GraphStorage.addNode(role);
      await GraphStorage.addNode(skill);

      const edge = {
        id: 'edge-1',
        source: 'role-1',
        target: 'skill-1',
        type: 'hasSkill',
        properties: {},
        metadata: { inferred: false, confidence: 1.0 }
      };

      await GraphStorage.addEdge(edge);

      // Query incoming edges to skill
      const incoming = await GraphStorage.getIncoming('skill-1');
      expect(incoming.length).toBe(1);
      expect(incoming[0].source).toBe('role-1');
    });

    test('should filter relationships by type', async () => {
      const node1 = {
        id: 'role-1',
        type: 'role',
        label: 'Developer',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };
      const node2 = {
        id: 'skill-1',
        type: 'skill',
        label: 'React',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };
      const node3 = {
        id: 'org-1',
        type: 'org',
        label: 'TechCorp',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };

      await GraphStorage.addNode(node1);
      await GraphStorage.addNode(node2);
      await GraphStorage.addNode(node3);

      const edges = [
        {
          id: 'edge-1',
          source: 'role-1',
          target: 'skill-1',
          type: 'hasSkill',
          properties: {},
          metadata: { inferred: false, confidence: 1.0 }
        },
        {
          id: 'edge-2',
          source: 'role-1',
          target: 'org-1',
          type: 'workedAt',
          properties: {},
          metadata: { inferred: false, confidence: 1.0 }
        }
      ];

      for (const edge of edges) {
        await GraphStorage.addEdge(edge);
      }

      // Query only 'hasSkill' relationships
      const hasSkillEdges = await GraphStorage.getOutgoing('role-1');
      const filtered = hasSkillEdges.filter(e => e.type === 'hasSkill');
      expect(filtered.length).toBe(1);
    });
  });

  describe('Graph Statistics', () => {
    test('should count nodes and edges', async () => {
      // Add 3 nodes
      for (let i = 0; i < 3; i++) {
        await GraphStorage.addNode({
          id: `skill-${i}`,
          type: 'skill',
          label: `Skill${i}`,
          properties: {},
          metadata: { createdAt: Date.now(), confidence: 1.0 }
        });
      }

      // Add 2 edges
      for (let i = 0; i < 2; i++) {
        await GraphStorage.addEdge({
          id: `edge-${i}`,
          source: `skill-${i}`,
          target: `skill-${i + 1}`,
          type: 'relatedTo',
          properties: {},
          metadata: { inferred: false, confidence: 1.0 }
        });
      }

      const stats = await GraphStorage.getStatistics();
      expect(stats.nodeCount).toBe(3);
      expect(stats.edgeCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing node gracefully', async () => {
      const retrieved = await GraphStorage.getNode('non-existent');
      expect(retrieved).toBeNull();
    });

    test('should prevent duplicate node IDs', async () => {
      const node = {
        id: 'unique-id',
        type: 'skill',
        label: 'JavaScript',
        properties: {},
        metadata: { createdAt: Date.now(), confidence: 1.0 }
      };

      await GraphStorage.addNode(node);
      
      // Adding same ID again should update, not error
      const updated = { ...node, label: 'JavaScript ES6' };
      await GraphStorage.addNode(updated);

      const retrieved = await GraphStorage.getNode('unique-id');
      expect(retrieved.label).toBe('JavaScript ES6');
    });
  });
});
