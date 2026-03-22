/**
 * Background Service Worker
 * Manages knowledge graph persistence and message handling
 */

importScripts("lib/knowledgeGraphManager.js");
importScripts("lib/sampleDataLoader.js");

let graphManager = null;
let apiKey = null;

/**
 * Initialize the graph manager on startup
 */
async function initializeExtension() {
  try {
    // Get API key from storage
    const result = await chrome.storage.local.get("apiKey");
    apiKey = result.apiKey;

    if (!apiKey) {
      console.warn("API key not found. Extension will work with limited functionality.");
    }

    // Initialize graph manager (always, even without API key)
    graphManager = new KnowledgeGraphManager(apiKey);

    // Load existing graph from storage
    const graphData = await chrome.storage.local.get("graph");
    if (graphData.graph && graphData.graph.nodes && Object.keys(graphData.graph.nodes).length > 0) {
      await graphManager.deserialize(graphData.graph);
      console.log(`Loaded existing knowledge graph with ${Object.keys(graphData.graph.nodes).length} nodes`);
    } else {
      // Start with completely empty graph - no sample data
      console.log("Starting with empty graph. Use 'Learn This Form' to add your data.");
    }

    console.log("Extension initialized successfully");
    console.log(`Graph status: ${graphManager.graph.size} nodes, ${graphManager.edges.length} edges`);
  } catch (error) {
    console.error("Error initializing extension:", error);
  }
}

/**
 * Load sample data into the graph
 */
async function loadSampleData() {
  try {
    if (!graphManager) {
      console.error("Graph manager not initialized");
      return;
    }

    console.log("Initializing with sample data...");

    if (!apiKey) {
      console.log("No API key available. Creating static fallback graph...");
      await createFallbackGraph();
      return;
    }

    try {
      // Load sample profile data
      const profileData = SampleDataLoader.getSampleProfileData();
      await graphManager.learnFromForm(profileData, "Sample Profile");

      // Load sample academic data
      const academicData = SampleDataLoader.getSampleAcademicData();
      await graphManager.learnFromForm(academicData, "Academic Info");

      // Load sample project data
      const projectData = SampleDataLoader.getSampleProjectData();
      await graphManager.learnFromForm(projectData, "Project Portfolio");

      // Load sample experience data
      const experienceData = SampleDataLoader.getSampleExperienceData();
      await graphManager.learnFromForm(experienceData, "Work Experience");

      // Save the populated graph
      await saveGraph();

      console.log(`Sample data loaded successfully via API. Graph now has ${graphManager.graph.size} nodes and ${graphManager.edges.length} edges`);

    } catch (apiError) {
      console.warn("API call failed, falling back to static graph:", apiError.message);
      await createFallbackGraph();
    }

  } catch (error) {
    console.error("Error loading sample data:", error);
    await createFallbackGraph();
  }
}

/**
 * Create fallback graph without API calls
 */
async function createFallbackGraph() {
  try {
    console.log("Creating comprehensive fallback graph...");

    // Clear any existing data
    graphManager.graph.clear();
    graphManager.edges = [];

    // Add core entities
    await graphManager.addNode("User", { type: "person", source: "system" });
    await graphManager.addNode("Govind", { type: "name", source: "system" });
    await graphManager.addNode("gov.grad@umd.edu", { type: "email", source: "system" });
    await graphManager.addNode("+1-301-555-0199", { type: "phone", source: "system" });
    await graphManager.addNode("College Park, MD 20740", { type: "address", source: "system" });
    await graphManager.addNode("University of Maryland", { type: "organization", source: "system" });
    await graphManager.addNode("Computer Science", { type: "field", source: "system" });
    await graphManager.addNode("Master of Science in Machine Learning", { type: "degree", source: "system" });
    await graphManager.addNode("Knowledge Graphs", { type: "skill", source: "system" });
    await graphManager.addNode("Machine Learning", { type: "skill", source: "system" });
    await graphManager.addNode("JavaScript", { type: "skill", source: "system" });
    await graphManager.addNode("Privacy-First Autofill System", { type: "project", source: "system" });
    await graphManager.addNode("AI Research Lab", { type: "organization", source: "system" });
    await graphManager.addNode("Research Engineer", { type: "position", source: "system" });

    // Add relationships
    graphManager.addEdge("User", "Govind", "HAS_NAME");
    graphManager.addEdge("User", "gov.grad@umd.edu", "HAS_EMAIL");
    graphManager.addEdge("User", "+1-301-555-0199", "HAS_PHONE");
    graphManager.addEdge("User", "College Park, MD 20740", "LIVES_AT");
    graphManager.addEdge("User", "University of Maryland", "STUDIES_AT");
    graphManager.addEdge("User", "Computer Science", "STUDIES");
    graphManager.addEdge("User", "Master of Science in Machine Learning", "PURSUING");
    graphManager.addEdge("User", "Knowledge Graphs", "EXPERT_IN");
    graphManager.addEdge("User", "Machine Learning", "EXPERT_IN");
    graphManager.addEdge("User", "JavaScript", "SKILLED_IN");
    graphManager.addEdge("User", "Privacy-First Autofill System", "DEVELOPED");
    graphManager.addEdge("User", "AI Research Lab", "WORKED_AT");
    graphManager.addEdge("User", "Research Engineer", "WORKED_AS");

    await saveGraph();

    console.log(`Fallback graph created with ${graphManager.graph.size} nodes and ${graphManager.edges.length} edges`);
  } catch (error) {
    console.error("Error creating fallback graph:", error);
  }
}

/**
 * Save graph to storage
 */
async function saveGraph() {
  if (!graphManager) return;
  const serialized = graphManager.serialize();
  await chrome.storage.local.set({ graph: serialized });
  console.log("Graph saved");
}

/**
 * Handle messages from content script and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.type) {
        case "LEARN_FROM_FORM":
          if (!graphManager) {
            console.error("Graph manager not initialized");
            sendResponse({ error: "Graph manager not initialized" });
            return;
          }
          console.log("Learning from form with data:", request.formData);
          const triples = await graphManager.learnFromForm(
            request.formData,
            request.context
          );
          console.log("Saving graph after learning...");
          await saveGraph();
          console.log("Graph saved successfully");
          sendResponse({ success: true, triples });
          break;

        case "AUTOFILL_FORM":
          if (!graphManager) {
            sendResponse({ error: "Graph manager not initialized" });
            return;
          }
          const filled = await graphManager.autofillForm(request.formFields);
          sendResponse({ success: true, filled });
          break;

        case "GET_GRAPH_STATS":
          if (!graphManager) {
            sendResponse({ stats: null });
            return;
          }
          const stats = graphManager.getStats();
          sendResponse({ stats });
          break;

        case "SET_API_KEY":
          apiKey = request.apiKey;
          await chrome.storage.local.set({ apiKey });
          graphManager = new KnowledgeGraphManager(apiKey);

          // Reload existing graph if it exists
          const existingGraph = await chrome.storage.local.get("graph");
          if (existingGraph.graph && existingGraph.graph.nodes && Object.keys(existingGraph.graph.nodes).length > 0) {
            await graphManager.deserialize(existingGraph.graph);
            console.log("Reloaded existing graph after API key change");
          } else {
            console.log("API key set. Graph is empty - ready to learn from forms.");
          }

          sendResponse({ success: true });
          break;

        case "GET_API_KEY_STATUS":
          sendResponse({ hasApiKey: !!apiKey });
          break;

        case "LOAD_SAMPLE_DATA":
          if (!graphManager) {
            sendResponse({ error: "Graph manager not initialized" });
            return;
          }
          try {
            await loadSampleData();
            sendResponse({ success: true });
          } catch (error) {
            console.error("Error loading sample data:", error);
            sendResponse({ error: error.message });
          }
          break;

        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error processing message:", error);
      sendResponse({ error: error.message });
    }
  })();

  return true;
});

/**
 * Initialize on install
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  initializeExtension();
});

// Initialize on startup
initializeExtension();
