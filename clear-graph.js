/**
 * Clear Graph Script
 * Run this to completely clear the extension's graph and start fresh
 */
async function clearExtensionGraph() {
  console.log("Clearing extension graph...");

  // Clear local storage
  await chrome.storage.local.set({ graph: null });
  console.log("✓ Graph cleared from storage");

  // Send message to background to reinitialize
  chrome.runtime.sendMessage({ type: "GET_GRAPH_STATS" }, (response) => {
    if (response && response.stats) {
      console.log(`Graph now has ${response.stats.nodeCount} nodes and ${response.stats.edgeCount} edges`);
    }
  });

  console.log("✓ Extension graph cleared. Ready for fresh learning!");
}

// Instructions for use
console.log(`
=== Clear Extension Graph ===

To clear the extension graph completely:

1. Open extension popup
2. Right-click → Inspect
3. Go to Console tab
4. Run: clearExtensionGraph()

Or clear manually:
chrome.storage.local.set({graph: null})

This will remove all learned data and start fresh.
`);