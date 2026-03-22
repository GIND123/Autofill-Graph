/**
 * Knowledge Graph Manager - Core engine for autofill system
 * Features:
 * - Semantic form interpretation
 * - Graph-based knowledge storage
 * - Vector embeddings for semantic matching
 * - Mistral API integration for LLM reasoning
 */

class KnowledgeGraphManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.graph = new Map(); // Node -> {data, embeddings}
    this.edges = []; // [{head, relation, tail}, ...]
    this.vectorDimensions = 384; // For simple embeddings
    this.initialized = false;
  }

  /**
   * Simple hash-based embedding generation (deterministic)
   * In production, this would use proper embeddings
   */
  async generateSimpleEmbedding(text) {
    const hash = (str) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        h = ((h << 5) - h) + char;
        h = h & h;
      }
      return h;
    };

    const baseHash = hash(text);
    const embedding = [];
    for (let i = 0; i < this.vectorDimensions; i++) {
      embedding.push(Math.sin((baseHash + i) / 1000) * 0.5 + 0.5);
    }
    return embedding;
  }

  /**
   * Cosine similarity between two embeddings
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    if (magnA === 0 || magnB === 0) return 0;
    return dotProduct / (magnA * magnB);
  }

  /**
   * Add a node to the knowledge graph
   */
  async addNode(nodeId, data) {
    const embedding = await this.generateSimpleEmbedding(nodeId);
    this.graph.set(nodeId, {
      data,
      embedding,
      lastUpdated: Date.now()
    });
  }

  /**
   * Add an edge (relationship) between nodes
   */
  addEdge(head, tail, relation) {
    this.edges.push({ head, tail, relation });
  }

  /**
   * Find nodes semantically similar to a query
   */
  async findSimilarNodes(query, topK = 5) {
    const queryEmbedding = await this.generateSimpleEmbedding(query);
    const similarities = [];

    for (const [nodeId, metadata] of this.graph.entries()) {
      const sim = this.cosineSimilarity(queryEmbedding, metadata.embedding);
      similarities.push({ nodeId, score: sim, data: metadata.data });
    }

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Call Mistral API to extract entities and relationships from form data
   */
  async learnFromForm(formData, context = "General Info") {
    try {
      console.log("Learning from form with data:", formData);

      const prompt = `You are a Knowledge Graph Architect.
Extract entities and relationships from this form data.

Data: ${JSON.stringify(formData)}
Context: ${context}

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "triples": [
    {"head": "Entity1", "relation": "RELATION", "tail": "Entity2"}
  ]
}

Rules:
- Use canonical names (e.g., "University of Maryland" not "UMD")
- Add 'User' as the central node
- Focus on professional and educational information`;

      console.log("Calling Mistral API for entity extraction...");
      const response = await this.callMistralAPI(prompt);
      console.log("API response:", response);

      const triples = response.triples || [];
      console.log(`Extracted ${triples.length} triples:`, triples);

      // Add nodes and edges to graph
      for (const triple of triples) {
        await this.addNode(triple.head, { type: "entity", source: context });
        await this.addNode(triple.tail, { type: "entity", source: context });
        this.addEdge(triple.head, triple.tail, triple.relation);
      }

      console.log(`Learned ${triples.length} facts from form: ${context}`);
      console.log(`Graph now has ${this.graph.size} nodes and ${this.edges.length} edges`);
      return triples;
    } catch (error) {
      console.error("Error learning from form:", error);
      console.error("Error stack:", error.stack);
      return [];
    }
  }

  /**
   * Auto-fill form fields based on knowledge graph
   */
  async autofillForm(formFields) {
    try {
      // Check if graph is empty
      if (this.graph.size === 0) {
        console.log("Graph is empty. Cannot autofill. Please learn from forms first.");
        return {};
      }

      // First try simple pattern matching
      const simpleMatches = this.getSimpleMatches(formFields);

      // If we have an API key, enhance with LLM
      if (this.apiKey) {
        try {
          const graphContext = this.edges.map(
            (e) => `(${e.head}) -[${e.relation}]-> (${e.tail})`
          );

          const prompt = `You are an Autofill Agent. Your job is to fill web form fields using a knowledge graph.

QUERY: Fill these form fields:
${formFields.map((f, i) => `${i + 1}. ${f}`).join("\n")}

KNOWLEDGE GRAPH (entities and relationships):
${graphContext.length > 0 ? graphContext.join("\n") : "Empty graph"}

Return ONLY valid JSON (no markdown, no explanation):
{
  "filled": {
    "field_name": "appropriate_value_from_graph"
  }
}

Rules:
- Use exact field names from the query
- Only use information from the knowledge graph
- Return "NULL" for fields you cannot fill
- Be consistent with names, emails, and professional info`;

          const response = await this.callMistralAPI(prompt);
          return response.filled || simpleMatches;
        } catch (apiError) {
          console.warn("API autofill failed, using simple matching:", apiError.message);
          return simpleMatches;
        }
      } else {
        console.log("No API key available, using simple pattern matching");
        return simpleMatches;
      }
    } catch (error) {
      console.error("Error autofilling form:", error);
      return {};
    }
  }

  /**
   * Simple pattern matching for form fields using actual graph data only
   */
  getSimpleMatches(formFields) {
    const matches = {};

    // Create lookup maps from actual graph data
    const nodesByType = new Map();
    for (const [node, metadata] of this.graph.entries()) {
      const type = metadata.data?.type || 'unknown';
      if (!nodesByType.has(type)) {
        nodesByType.set(type, []);
      }
      nodesByType.get(type).push(node);
    }

    // Common field patterns
    const patterns = {
      // Name patterns
      name: /\b(name|full.?name|first.?name|last.?name)\b/i,
      firstName: /\b(first.?name|fname|given.?name)\b/i,
      lastName: /\b(last.?name|lname|surname|family.?name)\b/i,

      // Contact patterns
      email: /\b(email|e.?mail|mail)\b/i,
      phone: /\b(phone|tel|telephone|mobile|cell)\b/i,
      address: /\b(address|location|street|city|state|zip|postal)\b/i,

      // Professional patterns
      company: /\b(company|employer|organization|org|workplace)\b/i,
      position: /\b(position|job|title|role|occupation)\b/i,
      skills: /\b(skills|expertise|technologies|tech|abilities)\b/i,

      // Academic patterns
      university: /\b(university|college|school|education|institution)\b/i,
      degree: /\b(degree|education|qualification|program|major)\b/i,

      // Other patterns
      bio: /\b(bio|biography|about|description|summary|profile)\b/i,
      website: /\b(website|url|link|portfolio|github)\b/i
    };

    for (const field of formFields) {
      let matchFound = false;

      // Try to match field name patterns with actual graph data
      for (const [patternType, regex] of Object.entries(patterns)) {
        if (regex.test(field) && !matchFound) {
          let value = null;

          switch (patternType) {
            case 'name':
            case 'firstName':
              value = nodesByType.get('name')?.[0];
              break;
            case 'email':
              value = nodesByType.get('email')?.[0];
              break;
            case 'phone':
              value = nodesByType.get('phone')?.[0];
              break;
            case 'address':
              value = nodesByType.get('address')?.[0];
              break;
            case 'company':
              value = nodesByType.get('organization')?.[0];
              break;
            case 'position':
              value = nodesByType.get('position')?.[0];
              break;
            case 'skills':
              const skills = nodesByType.get('skill') || [];
              if (skills.length > 0) {
                value = skills.join(', ');
              }
              break;
            case 'university':
              const orgs = nodesByType.get('organization') || [];
              value = orgs.find(org => /university|college|school/i.test(org));
              break;
            case 'degree':
              value = nodesByType.get('degree')?.[0];
              break;
            case 'bio':
              value = nodesByType.get('bio')?.[0];
              break;
            case 'website':
              value = nodesByType.get('website')?.[0];
              break;
          }

          if (value) {
            matches[field] = value;
            matchFound = true;
          }
        }
      }
    }

    console.log(`Simple matching filled ${Object.keys(matches).length}/${formFields.length} fields from learned data:`, matches);
    return matches;
  }

  /**
   * Call Mistral API with JSON response format
   */
  async callMistralAPI(prompt) {
    if (!this.apiKey) {
      throw new Error("API key not configured");
    }

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Mistral API error ${response.status}:`, errorText);
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    return JSON.parse(content);
  }

  /**
   * Get graph statistics for debugging
   */
  getStats() {
    return {
      nodeCount: this.graph.size,
      edgeCount: this.edges.length,
      nodes: Array.from(this.graph.keys()),
      edges: this.edges
    };
  }

  /**
   * Serialize graph for storage
   */
  serialize() {
    const nodes = {};
    for (const [nodeId, metadata] of this.graph.entries()) {
      nodes[nodeId] = metadata.data;
    }
    return {
      nodes,
      edges: this.edges,
      timestamp: Date.now()
    };
  }

  /**
   * Deserialize graph from storage
   */
  async deserialize(data) {
    this.edges = data.edges || [];
    for (const [nodeId, nodeData] of Object.entries(data.nodes || {})) {
      await this.addNode(nodeId, nodeData);
    }
  }
}

// Export for use in scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = KnowledgeGraphManager;
}
