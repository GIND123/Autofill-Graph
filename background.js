/**
 * Background Service Worker
 * Manages knowledge graph persistence and message handling
 */

importScripts("config.js");
importScripts("lib/knowledgeGraphManager.js");
importScripts("lib/sampleDataLoader.js");

let graphManager = null;
let apiKey = null;

/**
 * Initialize the graph manager on startup
 */
async function initializeExtension() {
  try {
    // Priority 1: Check config.js for hardcoded API key
    if (CONFIG.MISTRAL_API_KEY && CONFIG.MISTRAL_API_KEY !== "YOUR_API_KEY_HERE") {
      apiKey = CONFIG.MISTRAL_API_KEY;
      console.log("API key loaded from config.js");
      // Save to storage for consistency
      await chrome.storage.local.set({ apiKey });
    } else {
      // Priority 2: Get API key from storage (Settings tab)
      const result = await chrome.storage.local.get("apiKey");
      apiKey = result.apiKey;
    }

    if (!apiKey) {
      console.warn("API key not found. Extension will work with limited functionality.");
      console.log("Set API key in config.js or use Settings tab in popup.");
    } else {
      console.log("API key configured ✓");
    }

    // Initialize graph manager (always, even without API key)
    graphManager = new KnowledgeGraphManager(apiKey);

    // Load existing graph from storage
    const graphData = await chrome.storage.local.get("graph");
    if (graphData.graph && graphData.graph.entities && graphData.graph.entities.length > 0) {
      await graphManager.deserialize(graphData.graph);
      console.log(`Loaded existing knowledge graph with ${graphData.graph.entities.length} entities`);
    } else {
      // Start with completely empty graph - no sample data
      console.log("Starting with empty graph. Use 'Learn This Form' to add your data.");
    }

    console.log("Extension initialized successfully");
    console.log(`Graph status: ${graphManager.entities.size} entities, ${graphManager.relations.length} relations`);
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

      console.log(`Sample data loaded successfully via API. Graph now has ${graphManager.entities.size} entities and ${graphManager.relations.length} relations`);

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
 * Create fallback graph without API calls (Prototype2 structure)
 */
async function createFallbackGraph() {
  try {
    console.log("Creating comprehensive fallback graph...");

    // Clear any existing data
    graphManager.entities.clear();
    graphManager.attributes.clear();
    graphManager.relations = [];
    graphManager.inferences = [];

    // Add attributes using Prototype2 structure
    graphManager.storeAttribute("user", "full_name", "Govind", { source: "system" });
    graphManager.storeAttribute("user", "email", "gov.grad@umd.edu", { source: "system" });
    graphManager.storeAttribute("user", "phone", "+1-301-555-0199", { source: "system" });
    graphManager.storeAttribute("user", "address", "College Park, MD 20740", { source: "system" });
    graphManager.storeAttribute("user", "university", "University of Maryland", { source: "system" });
    graphManager.storeAttribute("user", "degree", "Master of Science in Machine Learning", { source: "system" });
    graphManager.storeAttribute("user", "skills", "Knowledge Graphs", { source: "system" });
    graphManager.storeAttribute("user", "skills", "Machine Learning", { source: "system" });
    graphManager.storeAttribute("user", "skills", "JavaScript", { source: "system" });

    // Add inferred facts
    graphManager.storeInference("city", "College Park", "address_parsing", ["College Park, MD 20740"], 0.8);
    graphManager.storeInference("state", "MD", "address_parsing", ["College Park, MD 20740"], 0.8);
    graphManager.storeInference("zip", "20740", "address_parsing", ["College Park, MD 20740"], 0.95);
    graphManager.storeInference("country", "USA", "phone_prefix", ["+1-301-555-0199"], 0.9);

    await saveGraph();

    console.log(`Fallback graph created with ${graphManager.entities.size} entities and ${graphManager.stats.facts_stored} facts`);
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

        case "GET_INSIGHTS":
          if (!graphManager) {
            sendResponse({ insights: null });
            return;
          }
          const insights = {
            inferences: graphManager.getInferences(),
            history: graphManager.getTemporalHistory(),
            privacy: graphManager.getPrivacyBreakdown()
          };
          sendResponse({ insights });
          break;

        case "SET_API_KEY":
          apiKey = request.apiKey;
          await chrome.storage.local.set({ apiKey });
          graphManager = new KnowledgeGraphManager(apiKey);

          // Reload existing graph if it exists
          const existingGraph = await chrome.storage.local.get("graph");
          if (existingGraph.graph && existingGraph.graph.entities && existingGraph.graph.entities.length > 0) {
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
