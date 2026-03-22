# Graph Learning Fix - Verification Guide

## What Was Fixed

### Critical Bug #1: JavaScript Error (.strip() method)
**Problem:** The code was calling `.strip()` on strings, which doesn't exist in JavaScript (it's a Python method)
**Fix:** Changed to `.trim()` in line 190 of `knowledgeGraphManager.js`
**Impact:** This was causing ALL API calls to fail silently

### Critical Bug #2: Graph Data Loss on API Key Update
**Problem:** When saving a new API key, the extension created a new empty graph manager, losing all learned data
**Fix:** Now reloads existing graph after API key change in `background.js`
**Impact:** Preserves your learned knowledge when updating credentials

### Enhancement #3: Detailed Logging
**Added:** Comprehensive console logs throughout the learning pipeline
**Impact:** Easy to debug and verify the system is working

---

## How to Verify the Fix Works

### Step 1: Reload Extension
```
1. Go to chrome://extensions/
2. Find "Autofill Graph"
3. Click the reload icon (circular arrow)
4. Verify no errors in console
```

### Step 2: Open Browser Console
```
1. Click extension icon
2. Right-click anywhere in popup
3. Select "Inspect"
4. Go to "Console" tab
5. Keep this open during testing
```

### Step 3: Test Learning

#### On Any Website with a Form:
1. Fill out a simple form manually:
   - Name: Your Name
   - Email: your.email@example.com
   - Company: Your Company
   - Location: Your City

2. Click extension icon → "Learn This Form"

3. Watch the console for these logs:
   ```
   Learning from form with data: {Name: ..., Email: ...}
   Calling Mistral API for entity extraction...
   API response: {triples: [...]}
   Extracted X triples: [...]
   Learned X facts from form: Web Form
   Graph now has Y nodes and Z edges
   Saving graph after learning...
   Graph saved successfully
   ```

4. Check Graph Stats in popup:
   - Entities count should INCREASE
   - Relationships count should INCREASE

#### Expected Console Output Example:
```
Learning from form with data: Object { Name: "John Doe", Email: "john@example.com" }
Calling Mistral API for entity extraction...
API response: Object { triples: Array(3) }
Extracted 3 triples:
[
  {head: "User", relation: "HAS_NAME", tail: "John Doe"},
  {head: "User", relation: "HAS_EMAIL", tail: "john@example.com"},
  {head: "John Doe", relation: "WORKS_AT", tail: "Example Corp"}
]
Learned 3 facts from form: Web Form
Graph now has 17 nodes and 13 edges
Saving graph after learning...
Graph saved successfully
```

### Step 4: Verify Data Persistence

1. Close and reopen the browser
2. Open extension popup
3. Check "Graph Status":
   - Entity count should match previous session
   - Relationship count should match previous session

### Step 5: Test Autofill with Learned Data

1. Visit a different website with a form
2. Click "Autofill"
3. Check if your learned data (name, email, company) appears in fields
4. Console should show:
   ```
   Autofilling form...
   Form autofilled successfully!
   ```

---

## Troubleshooting

### If Learning Still Doesn't Work:

**Check Console for Errors:**
```javascript
// Look for:
- "Mistral API error: XXX" → API key issue
- "Graph manager not initialized" → Extension not loaded
- "Error learning from form: ..." → Check error message
```

**Common Issues:**

1. **API Key Invalid**
   - Symptom: "Mistral API error: 401" or "403"
   - Fix: Go to Settings → Re-enter API key → Save

2. **No Form Data Captured**
   - Symptom: "Learning from form with data: {}"
   - Fix: Make sure form fields are filled before clicking "Learn"

3. **Network Error**
   - Symptom: "Failed to fetch" or "Network error"
   - Fix: Check internet connection

4. **Extension Not Reloaded**
   - Symptom: Old console logs, no new logging
   - Fix: chrome://extensions/ → Reload extension

---

## Detailed Test Case

### Full Learning Test:

**Form Data to Test:**
```
Name: Alice Johnson
Email: alice.j@techcorp.com
Company: TechCorp Inc
Position: Senior Developer
Skills: Python, JavaScript, ML
Location: San Francisco, CA
```

**Expected Triples (Example):**
```json
{
  "triples": [
    {"head": "User", "relation": "HAS_NAME", "tail": "Alice Johnson"},
    {"head": "User", "relation": "HAS_EMAIL", "tail": "alice.j@techcorp.com"},
    {"head": "User", "relation": "WORKS_AT", "tail": "TechCorp Inc"},
    {"head": "User", "relation": "HAS_ROLE", "tail": "Senior Developer"},
    {"head": "User", "relation": "EXPERT_IN", "tail": "Python"},
    {"head": "User", "relation": "EXPERT_IN", "tail": "JavaScript"},
    {"head": "User", "relation": "EXPERT_IN", "tail": "ML"},
    {"head": "User", "relation": "LIVES_IN", "tail": "San Francisco, CA"},
    {"head": "Alice Johnson", "relation": "WORKS_AT", "tail": "TechCorp Inc"}
  ]
}
```

**What to Check:**
- Console shows all triples
- Graph size increases by ~9 entities (new unique entities)
- Graph edges increase by 9 relationships
- "Graph saved successfully" appears

---

## Debug Commands

### Check Current Graph State:
Open console in extension popup and run:
```javascript
chrome.runtime.sendMessage({type: "GET_GRAPH_STATS"}, (response) => {
  console.log("Current graph:", response.stats);
  console.log("Nodes:", response.stats.nodeCount);
  console.log("Edges:", response.stats.edgeCount);
  console.log("Entities:", response.stats.nodes);
});
```

### Check Stored Data:
```javascript
chrome.storage.local.get("graph", (data) => {
  console.log("Stored graph:", data.graph);
  console.log("Node count:", Object.keys(data.graph.nodes).length);
  console.log("Edge count:", data.graph.edges.length);
});
```

### Clear Graph (If Needed):
```javascript
chrome.storage.local.set({graph: null}, () => {
  console.log("Graph cleared");
  location.reload(); // Reload popup
});
```

---

## Expected Behavior After Fix

### BEFORE Fix:
- Click "Learn This Form" → Error in console
- `.strip()` is not a function error
- No data saved
- Graph size stays at 14 entities

### AFTER Fix:
- Click "Learn This Form" → Success message
- Console shows detailed extraction process
- Data saved to chrome.storage
- Graph size increases
- Data persists across sessions

---

## Verification Checklist

- [ ] Extension reloaded successfully
- [ ] Console open and monitoring
- [ ] Fill out test form
- [ ] Click "Learn This Form"
- [ ] See "Learning from form..." in console
- [ ] See API response in console
- [ ] See extracted triples in console
- [ ] See "Graph now has X nodes" message
- [ ] See "Graph saved successfully" message
- [ ] Graph Status shows increased counts
- [ ] Close and reopen browser
- [ ] Graph Status still shows same counts
- [ ] Autofill uses newly learned data

---

## Success Indicators

✓ No JavaScript errors in console
✓ Detailed logs appear when learning
✓ Graph statistics increase after learning
✓ Data persists after browser restart
✓ Autofill uses learned information

---

If all checks pass, the graph learning is now working correctly!

**Git Commit:** 04a1524
**Files Changed:**
- lib/knowledgeGraphManager.js (fixed .strip() → .trim())
- background.js (reload graph on API key change + logging)
