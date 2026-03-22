/**
 * Background Service Worker
 * Manages knowledge graph persistence and message handling
 */

importScripts("lib/knowledgeGraphManager.js");

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
      console.warn("API key not found. Please configure in popup.");
      return;
    }

    // Initialize graph manager
    graphManager = new KnowledgeGraphManager(apiKey);

    // Load existing graph from storage
    const graphData = await chrome.storage.local.get("graph");
    if (graphData.graph) {
      await graphManager.deserialize(graphData.graph);
      console.log("Loaded existing knowledge graph");
    } else {
      console.log("Starting with empty knowledge graph");
    }

    console.log("Extension initialized");
  } catch (error) {
    console.error("Error initializing extension:", error);
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
          if (existingGraph.graph) {
            await graphManager.deserialize(existingGraph.graph);
            console.log("Reloaded existing graph after API key change");
          }

          sendResponse({ success: true });
          break;

        case "GET_API_KEY_STATUS":
          sendResponse({ hasApiKey: !!apiKey });
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
