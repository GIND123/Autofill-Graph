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
      const graphContext = this.edges.map(
        (e) => `(${e.head}) -[${e.relation}]-> (${e.tail})`
      );

      const prompt = `You are an Autofill Agent. Your job is to fill web form fields using a knowledge graph.

QUERY: Fill these form fields:
${formFields.map((f, i) => `${i + 1}. ${f}`).join("\n")}

KNOWLEDGE GRAPH (entities and relationships):
${graphContext.length > 0 ? graphContext.join("\n") : "Empty graph"}

INSTRUCTIONS:
- For each field, search the knowledge graph for matching information
- Use semantic reasoning to infer values (e.g., if City is 'College Park', State might be 'MD')
- Return "NULL" only if absolutely no information exists
- Generate short text (1-2 sentences) for narrative fields
- Be concise and professional

Return ONLY a valid JSON object (no markdown):
{
  "Field_Label": "Filled_Value"
}`;

      return await this.callMistralAPI(prompt);
    } catch (error) {
      console.error("Error autofilling form:", error);
      return {};
    }
  }

  /**
   * Call Mistral API with JSON response format
   */
  async callMistralAPI(prompt) {
    const response = await fetch("https://api.mistral.ai/v0/chat/completions", {
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
      throw new Error(`Mistral API error: ${response.status}`);
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
