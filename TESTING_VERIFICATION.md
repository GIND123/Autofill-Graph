# Extension Testing & Verification Guide

## ✅ CRITICAL FIXES IMPLEMENTED

### Problem: Extension starts with empty graph
**Solution:** Added automatic sample data loading in background.js
- Imports sampleDataLoader.js
- Loads sample data if graph is empty on initialization
- Creates fallback graph if API fails
- Sample data includes profile, academic, project, and experience data

### Problem: No way to reset or reload data
**Solution:** Added "Load Sample Data" button in Settings tab
- Button in Data Management section
- Calls LOAD_SAMPLE_DATA message to background
- Provides user feedback on success/failure

### Problem: Graph not initialized when API key is first set
**Solution:** Enhanced SET_API_KEY handler
- Checks if graph is empty when API key is set
- Automatically loads sample data for new users
- Preserves existing graph for returning users

## 🧪 TESTING PROCEDURE

### Step 1: Install/Reload Extension
```
1. Go to chrome://extensions/
2. Click reload button on "Autofill Graph"
3. Check for any errors in extension card
4. Open browser console to monitor initialization
```

### Step 2: Check Sample Data Loading
```
1. Click extension icon
2. Check Graph Status shows entities > 0
3. If empty, go to Settings → Load Sample Data
4. Verify Graph Status updates with 14+ entities
```

### Step 3: Test Form Detection
```
1. Open test-form.html (automatically opened)
2. Click "Detect Forms"
3. Should show: "Found 1 forms with 7 input fields"
4. If fails, check browser console for errors
```

### Step 4: Test Learning Functionality
```
1. Fill out test-form.html manually:
   - Name: John Doe
   - Email: john.doe@example.com
   - Company: Tech Corp
   - Position: Software Engineer
   - Skills: Python, JavaScript
   - Location: San Francisco, CA
   - Bio: Experienced developer...

2. Click "Learn This Form"
3. Should show: "Successfully learned from form!"
4. Check Graph Status - entities should increase
5. Go to Graph View tab - should see new entities
```

### Step 5: Test Autofill Functionality
```
1. Refresh test-form.html page
2. Click "Detect Forms" (should see 1 form, 7 inputs)
3. Click "Autofill"
4. Fields should fill with data (green background)
5. Verify filled values match learned data
```

## 🔍 DEBUGGING COMMANDS

### Check Extension Console
Open popup → Right-click → Inspect → Console:
```javascript
// Run diagnostics
runDiagnostics()

// Check graph stats
chrome.runtime.sendMessage({type: "GET_GRAPH_STATS"}, console.log)

// Check API key
chrome.runtime.sendMessage({type: "GET_API_KEY_STATUS"}, console.log)

// Load sample data manually
chrome.runtime.sendMessage({type: "LOAD_SAMPLE_DATA"}, console.log)
```

### Check Background Console
Go to chrome://extensions/ → Autofill Graph → "Inspect views: background page":
```javascript
// Check graph manager status
console.log("Graph manager:", !!graphManager)
console.log("API key:", !!apiKey)
console.log("Graph size:", graphManager?.graph?.size)

// Check storage
chrome.storage.local.get("graph", console.log)
chrome.storage.local.get("apiKey", console.log)
```

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue: "Graph manager not initialized"
**Solution:**
1. Check API key is configured
2. Reload extension
3. Check background console for initialization errors

### Issue: Sample data not loading
**Solution:**
1. Verify API key is valid
2. Check internet connection
3. Use "Load Sample Data" button manually
4. Check fallback graph creation in console

### Issue: Forms still not detected
**Solution:**
1. Ensure page has standard HTML forms
2. Refresh page after extension reload
3. Try test-form.html first for validation
4. Check content script injection in console

### Issue: Learning fails with API errors
**Solution:**
1. Verify Mistral API key at console.mistral.ai
2. Check API rate limits (free tier: 100 requests/month)
3. Ensure internet connection is stable
4. Try simpler forms first

## ✨ EXPECTED BEHAVIOR

### On Fresh Installation:
1. Extension loads with sample data (14+ entities)
2. API key prompt in Settings
3. Graph View shows sample entities and relationships
4. Ready for immediate testing

### After API Key Configuration:
1. Sample data loads automatically if graph was empty
2. Learning functionality becomes available
3. Autofill works with pre-loaded + learned data
4. Graph continuously improves with use

### On Form Interaction:
1. Detect Forms: Instant response with count
2. Learn This Form: 1-3 seconds, entities increase
3. Autofill: 1-3 seconds, fields fill with green highlight
4. All operations provide clear user feedback

## 📊 SUCCESS METRICS

- ✅ Graph starts with 10+ entities (sample data)
- ✅ Form detection works on test-form.html
- ✅ Learning adds new entities to graph
- ✅ Autofill fills 80%+ of form fields
- ✅ No JavaScript errors in console
- ✅ All user actions provide feedback messages

## 🚀 PERFORMANCE EXPECTATIONS

- Form detection: < 500ms
- Sample data loading: < 3 seconds
- Learning from form: 1-3 seconds (API dependent)
- Autofill completion: 1-3 seconds (API dependent)
- Graph operations: < 100ms (local storage)

## 📋 FINAL CHECKLIST

Before reporting "working":
- [ ] Extension reloaded without errors
- [ ] Sample data loaded automatically
- [ ] Graph Status shows 10+ entities
- [ ] test-form.html detects correctly
- [ ] Learning increases entity count
- [ ] Autofill fills test form fields
- [ ] All buttons provide feedback
- [ ] No console errors during testing
- [ ] API key saves and persists

If ALL items checked: **Extension is fully functional! 🎉**

---
**Created:** March 22, 2026
**Version:** 1.0.2 with critical fixes
**Test Status:** Ready for validation