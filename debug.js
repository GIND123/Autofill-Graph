/**
 * Debug Helper Script
 * Run this in the browser console (popup or background page) to diagnose issues
 */

async function runDiagnostics() {
  console.log("=== Autofill Graph Diagnostics ===\n");

  // 1. Check API Key
  console.log("1. Checking API Key...");
  const apiKeyData = await chrome.storage.local.get("apiKey");
  if (apiKeyData.apiKey) {
    console.log("✓ API Key is configured");
    console.log(`  Length: ${apiKeyData.apiKey.length} characters`);
  } else {
    console.log("✗ API Key NOT configured");
  }

  // 2. Check Graph Data
  console.log("\n2. Checking Graph Data...");
  const graphData = await chrome.storage.local.get("graph");
  if (graphData.graph) {
    console.log("✓ Graph data exists");
    console.log(`  Nodes: ${Object.keys(graphData.graph.nodes || {}).length}`);
    console.log(`  Edges: ${(graphData.graph.edges || []).length}`);
    console.log(`  Timestamp: ${new Date(graphData.graph.timestamp).toLocaleString()}`);
  } else {
    console.log("✗ No graph data found");
  }

  // 3. Check Extension Permissions
  console.log("\n3. Checking Permissions...");
  const permissions = await chrome.permissions.getAll();
  console.log("  Permissions:", permissions.permissions);
  console.log("  Host permissions:", permissions.origins);

  // 4. Test Message Passing
  console.log("\n4. Testing Message Passing...");
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_GRAPH_STATS" }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(resp);
        }
      });
    });

    if (response.error) {
      console.log("✗ Message passing failed:", response.error);
    } else if (response.stats) {
      console.log("✓ Message passing works");
      console.log(`  Graph has ${response.stats.nodeCount} nodes and ${response.stats.edgeCount} edges`);
    } else {
      console.log("⚠ Message passing works but no stats returned");
    }
  } catch (error) {
    console.log("✗ Message passing error:", error);
  }

  // 5. Check for Active Tab (if run from popup)
  console.log("\n5. Checking Active Tab...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      console.log("✓ Active tab found");
      console.log(`  URL: ${tab.url}`);
      console.log(`  Title: ${tab.title}`);
    } else {
      console.log("✗ No active tab found");
    }
  } catch (error) {
    console.log("  (Skipped - not available in this context)");
  }

  // 6. Storage Size Check
  console.log("\n6. Checking Storage Usage...");
  const allStorage = await chrome.storage.local.get(null);
  const storageSize = JSON.stringify(allStorage).length;
  console.log(`  Total storage size: ${(storageSize / 1024).toFixed(2)} KB`);
  console.log(`  Available: ${((10 * 1024 - storageSize / 1024) / 1024).toFixed(2)} MB / 10 MB`);

  console.log("\n=== Diagnostics Complete ===");
  return {
    hasApiKey: !!apiKeyData.apiKey,
    hasGraph: !!graphData.graph,
    graphNodeCount: Object.keys(graphData.graph?.nodes || {}).length,
    graphEdgeCount: (graphData.graph?.edges || []).length,
    storageKB: (storageSize / 1024).toFixed(2)
  };
}

// Auto-run if in console
if (typeof window !== "undefined") {
  console.log("Debug script loaded. Run: runDiagnostics()");
}
