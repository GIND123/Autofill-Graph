/**
 * Test Prototype2 Implementation
 * Run this in the browser console (popup or background) to verify everything works
 */

async function testPrototype2() {
  console.log("=== Testing Prototype2 Implementation ===\n");

  // Test 1: Check graph manager is initialized
  console.log("Test 1: Graph Manager Initialization");
  chrome.runtime.sendMessage({ type: "GET_GRAPH_STATS" }, (response) => {
    if (response && response.stats) {
      console.log("✓ Graph manager initialized");
      console.log("  Entities:", response.stats.entities || response.stats.nodeCount || 0);
      console.log("  Relations:", response.stats.relations || response.stats.edgeCount || 0);
      console.log("  Facts (current):", response.stats.facts_current || 0);
      console.log("  Facts (inferred):", response.stats.facts_inferred || 0);
    } else {
      console.log("✗ Graph manager not initialized");
    }
  });

  // Test 2: Check insights available
  console.log("\nTest 2: Insights Functionality");
  chrome.runtime.sendMessage({ type: "GET_INSIGHTS" }, (response) => {
    if (response && response.insights) {
      console.log("✓ Insights available");
      console.log("  Inferences:", response.insights.inferences?.length || 0);
      console.log("  Temporal history entries:", Object.keys(response.insights.history || {}).length);
      console.log("  Privacy breakdown:", response.insights.privacy);
    } else {
      console.log("✗ Insights not available");
    }
  });

  // Test 3: Check API key status
  console.log("\nTest 3: API Key Status");
  chrome.runtime.sendMessage({ type: "GET_API_KEY_STATUS" }, (response) => {
    if (response) {
      console.log(response.hasApiKey ? "✓ API key configured" : "⚠ API key not configured (limited functionality)");
    }
  });

  console.log("\n=== Test Complete ===");
  console.log("Check the results above. All tests should pass with ✓ marks.");
  console.log("\nNext steps:");
  console.log("1. If graph is empty, fill out a form and click 'Learn This Form'");
  console.log("2. Open the Insights tab to see inferred facts");
  console.log("3. Try autofilling a form to test two-phase autofill");
}

// Auto-run test
testPrototype2();

console.log("\nTo run test again, type: testPrototype2()");
