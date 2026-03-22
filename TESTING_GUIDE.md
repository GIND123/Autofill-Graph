# 🧪 Testing Guide - Autofill Graph Extension

This guide helps you verify the extension is working correctly.

## Quick Test (5 minutes)

### 1. Verify Installation
```
✅ Do this:
- Open chrome://extensions/
- Search for "Autofill Graph"
- Should see extension listed with blue icon
- Should show "Enabled" status

❌ If missing:
- Did you load the unpacked folder? Check SETUP_GUIDE.md
```

### 2. Verify API Configuration
```
✅ Do this:
- Click extension icon in toolbar
- Go to "Settings" tab
- Paste your Mistral API key
- Click "Save API Key"
- Wait 2 seconds

✅ Expected Result:
- Should see "✅ Connected" message
- Should see ✅ status in header

❌ If it says "Disconnected":
- Check if API key is correct (from console.mistral.ai)
- Make sure you have internet connection
```

### 3. Test Form Detection
```
✅ Do this:
- Visit any website with a form (Google Form, GitHub signup, etc.)
- Click extension icon
- On "Quick Actions" tab, click "🔍 Detect Forms"

✅ Expected Result:
- Should say "Found X forms with Y input fields"
- Green success message

❌ If it says "No forms found":
- Try a different website
- Some dynamic forms may not be detected immediately
```

### 4. Test Sample Data Loading
```
✅ Do this:
- Extension should have automatically loaded sample data
- Click extension icon
- Look at "Quick Actions" tab
- Check the "Graph Status" box

✅ Expected Result:
- Should show:
  - Entities: 14+
  - Relationships: 10+
  - Ready to Autofill: ✅ Yes

❌ If graph is empty:
- Check that API key was saved
- The background script initializes on first run
- Try closing and reopening the extension
```

### 5. Test Autofill
```
✅ Do this:
1. Visit this form: https://www.google.com/forms/about/
   (Or create a test form with fields: Name, Email, School)

2. Click extension icon, then "🔍 Detect Forms"

3. Click "✨ Autofill" button

✅ Expected Result:
- Form fields should fill with values:
  - Name: "Govind"
  - Email: "gov.grad@umd.edu"
  - Fields turn light green when filled

❌ If nothing happens:
- Check browser console (F12) for JavaScript errors
- Verify API key is configured
- Check that forms were detected
```

### 6. Test Learning
```
✅ Do this:
1. Go to any form
2. Manually fill in some fields with your information
3. Click extension icon
4. Click "📚 Learn This Form"
5. Wait 2 seconds

✅ Expected Result:
- Should see "✅ Successfully learned from form!"
- Graph statistics should update (Entities and Relationships count increase)

❌ If it fails:
- Check console for API errors
- Verify the form has visible labels
```

## Advanced Testing

### Test Vector DB Similarity
```javascript
// Run in extension background context (F12 -> Sources -> background.js)
const query = "University";
const results = await graphManager.findSimilarNodes(query, 5);
console.table(results);

// Should show nodes sorted by similarity score
```

### Test Graph Serialization
```javascript
// In background.js context
const serialized = graphManager.serialize();
console.log(JSON.stringify(serialized, null, 2));

// Should show JSON with nodes and edges
```

### Test API Communication
```javascript
// In background.js context
const response = await graphManager.callMistralAPI("List 3 programming languages in JSON format");
console.log(response);
```

## Common Issues & Solutions

### Issue: Extension doesn't appear in toolbar
**Solution:**
- Make sure you loaded the unpacked folder (not just opened the folder)
- Check that manifest.json exists in the root folder
- Try: `chrome://extensions/?id=[extension-id]` to see error

### Issue: "API Key not configured" keeps appearing
**Solution:**
- Copy the full API key from Mistral console (including full string)
- Make sure no extra spaces at beginning/end
- Try pasting again and saving

### Issue: Forms detected but autofill returns empty values
**Solution:**
- Check that sample data was loaded (Graph Status shows entities > 0)
- Try learning from a simpler form first
- Check console (F12) for API errors

### Issue: Autofill takes too long (>2 seconds)
**Solution:**
- This is expected for the first request (API round trip)
- Subsequent requests within same session should be faster
- Check your internet connection speed

### Issue: "Error learning from form"
**Solution:**
- Make sure form fields have visible labels or placeholders
- Try a different form with clearer field labels
- Check API quota (first 100 requests are free)

## Performance Benchmarks

Expected timings:
- Form detection: <100ms
- Autofill (with API call): 1-3 seconds
- Learning from form: 1-2 seconds
- Graph query: <50ms

## Debugging Tips

### Enable Detailed Logs
```javascript
// In background.js top-level
const DEBUG = true;
// Then look for console.log statements
```

### Check Stored Data
```javascript
// In any extension context
chrome.storage.local.get(null, (items) => {
  console.log("Stored data:", items);
});
```

### Inspect Knowledge Graph
```javascript
// View all nodes and edges
chrome.runtime.sendMessage(
  {type: "GET_GRAPH_STATS"},
  (response) => console.log(response.stats)
);
```

### Monitor API Calls
```
1. Open F12 (DevTools)
2. Go to Network tab
3. Filter by "mistral"
4. Try autofilling a form
5. You should see POST requests to api.mistral.ai
```

## Test Scenarios

### Scenario 1: Basic Autofill
**Setup:**
- Extension installed and configured
- Sample data loaded

**Test:**
1. Visit https://formspree.io/
2. Detect forms
3. Autofill
4. Check fields are filled

**Expected:** ✅ Name, Email fields filled
**Assessment:** ✅ PASS / ❌ FAIL

### Scenario 2: Learning
**Setup:**
- Extension installed and configured

**Test:**
1. Fill out a form completely
2. Click "Learn This Form"
3. Check Graph Status

**Expected:** Entities count increases
**Assessment:** ✅ PASS / ❌ FAIL

### Scenario 3: Multi-Form Learning
**Setup:**
- Extension installed

**Test:**
1. Learn from 3 different forms
2. Visit a new form
3. Autofill with information from learned forms

**Expected:** Autofill accurately combines information from multiple sources
**Assessment:** ✅ PASS / ❌ FAIL

### Scenario 4: Data Persistence
**Setup:**
- Extension with loaded graph

**Test:**
1. Close and reopen browser
2. Go to chrome://extensions/
3. Click extension icon
4. Check Graph Status

**Expected:** Same entities and relationships still present
**Assessment:** ✅ PASS / ❌ FAIL

## End-to-End Test Script

```javascript
// Paste this in DevTools console on any website
async function runTests() {
  console.log("🧪 Running tests...");

  // Test 1: Check API
  await new Promise(resolve => {
    chrome.runtime.sendMessage({type: "GET_API_KEY_STATUS"}, (r) => {
      console.log(`✅ API Status: ${r.hasApiKey ? "Configured" : "Not Configured"}`);
      resolve();
    });
  });

  // Test 2: Check Graph
  await new Promise(resolve => {
    chrome.runtime.sendMessage({type: "GET_GRAPH_STATS"}, (r) => {
      console.log(`✅ Graph Stats: ${r.stats?.nodeCount || 0} nodes, ${r.stats?.edgeCount || 0} edges`);
      resolve();
    });
  });

  // Test 3: Detect Forms
  chrome.runtime.sendMessage({type: "DETECT_FORMS"}, (r) => {
    console.log(`✅ Forms Detected: ${r.stats?.forms || 0}`);
  });

  console.log("🎉 All tests completed!");
}

runTests();
```

---

**All tests passing?** 🎉 Your extension is ready to use!

**Still having issues?** Check the console (F12) for error messages and compare with Common Issues section above.
