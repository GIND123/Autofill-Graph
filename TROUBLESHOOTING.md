# Troubleshooting Guide - Form Detection & Learning Issues

## Quick Diagnostic Steps

### Step 1: Reload Extension
```
1. Go to chrome://extensions/
2. Find "Autofill Graph"
3. Click the reload icon (circular arrow)
4. Check for any errors in the extension card
```

### Step 2: Run Diagnostics
```
1. Click extension icon
2. Right-click popup → Inspect
3. Go to Console tab
4. Paste and run: runDiagnostics()
5. Check the output for errors
```

### Step 3: Test on Simple Form
```
1. Open test-form.html (included in the repository)
2. Or visit: https://www.w3schools.com/html/html_forms.asp
3. Try detecting forms and learning
```

## Common Issues & Fixes

### Issue 1: "Content script not loaded"

**Symptoms:**
- Clicking "Detect Forms" shows error
- "Learn This Form" fails

**Cause:**
- Extension not properly injected into the page
- Page loaded before extension was ready

**Fix:**
1. Refresh the webpage (Ctrl+R / Cmd+R)
2. Try clicking "Detect Forms" again
3. If still fails, reload extension

### Issue 2: "No form fields detected"

**Symptoms:**
- "Detect Forms" returns 0 forms
- Cannot autofill or learn

**Cause:**
- Page has no standard HTML forms
- Forms use custom JavaScript frameworks
- Fields are hidden or dynamically loaded

**Fix:**
1. Check if page actually has visible input fields
2. Try a different, simpler website
3. Wait for page to fully load before clicking buttons
4. Use test-form.html for testing

### Issue 3: "No field values found. Please fill the form first."

**Symptoms:**
- "Learn This Form" fails
- Error says no values found

**Cause:**
- Form fields are empty
- Extension can't read field values

**Fix:**
1. Manually fill in the form fields first
2. Then click "Learn This Form"
3. Ensure fields have actual text, not placeholder text
4. Check browser console for specific errors

### Issue 4: Graph not created / Learning fails silently

**Symptoms:**
- "Learn This Form" says success but graph stays empty
- No entities added

**Cause:**
- API key missing or invalid
- Mistral API errors
- Network issues

**Fix:**
1. Check API key in Settings tab
2. Open browser console (F12) and check for API errors
3. Look for "Mistral API error: XXX" messages
4. Verify internet connection
5. Test API key at https://console.mistral.ai

### Issue 5: "API key not configured"

**Symptoms:**
- Status shows "API key not configured"
- Red error message

**Cause:**
- No API key saved
- API key cleared

**Fix:**
1. Go to Settings tab
2. Enter your Mistral API key
3. Click "Save API Key"
4. Check status changes to "Connected"

### Issue 6: Extension permissions error

**Symptoms:**
- Cannot access tabs
- Content script injection fails

**Cause:**
- Extension permissions not granted
- Chrome requires permission for specific sites

**Fix:**
1. Go to chrome://extensions/
2. Click on "Autofill Graph"
3. Ensure "On all sites" is enabled
4. Or manually allow specific sites

## Debugging Commands

### Check Graph in Console

Open popup console (right-click popup → Inspect):

```javascript
// Check graph stats
chrome.runtime.sendMessage({type: "GET_GRAPH_STATS"}, (r) => {
  console.log("Node count:", r.stats.nodeCount);
  console.log("Edge count:", r.stats.edgeCount);
  console.log("Nodes:", r.stats.nodes);
  console.log("Edges:", r.stats.edges);
});

// Check storage directly
chrome.storage.local.get("graph", (data) => {
  console.log("Stored graph:", data.graph);
  if (data.graph) {
    console.log("Nodes:", Object.keys(data.graph.nodes).length);
    console.log("Edges:", data.graph.edges.length);
  }
});

// Check API key status
chrome.runtime.sendMessage({type: "GET_API_KEY_STATUS"}, (r) => {
  console.log("Has API key:", r.hasApiKey);
});

// Clear graph (reset)
chrome.storage.local.set({graph: null}, () => {
  console.log("Graph cleared");
  location.reload();
});
```

### Check Content Script on Page

Open page console (F12 on the webpage):

```javascript
// Check if content script loaded
console.log("Content script active:", typeof formDetector !== 'undefined');

// Manually detect forms
if (typeof formDetector !== 'undefined') {
  const stats = formDetector.detectForms();
  console.log("Forms:", stats.forms);
  console.log("Inputs:", stats.inputs);
}
```

## Testing Workflow

### Complete Test Procedure

1. **Setup:**
   ```
   - Reload extension
   - Verify API key is configured
   - Check status shows "Connected"
   ```

2. **Open Test Page:**
   ```
   - Open test-form.html in browser
   - Or use any simple form online
   ```

3. **Test Detection:**
   ```
   - Click "Detect Forms"
   - Should show: "Found 1 forms with 7 input fields"
   - If fails, check console for errors
   ```

4. **Test Learning:**
   ```
   - Fill out all form fields manually
   - Click "Learn This Form"
   - Should show: "Successfully learned from form!"
   - Check Graph Status: Entities should increase
   ```

5. **Verify Graph:**
   ```
   - Go to Graph View tab
   - Should see new entities and relationships
   - Node count should be > 0
   ```

6. **Test Autofill:**
   ```
   - Refresh the page
   - Click "Detect Forms"
   - Click "Autofill"
   - Fields should fill with your learned data
   - Filled fields turn light green
   ```

## Error Messages Explained

| Error Message | Meaning | Action |
|--------------|---------|--------|
| "Content script not loaded" | Extension not injected into page | Refresh page |
| "No form fields detected" | No input elements found | Check page has forms |
| "No field values found" | Form is empty | Fill form first |
| "Mistral API error: 401" | Invalid API key | Update API key |
| "Mistral API error: 429" | Rate limit exceeded | Wait and try again |
| "Runtime error" | Chrome extension API issue | Reload extension |
| "No active tab found" | Tab query failed | Close and reopen popup |

## Still Problems?

If none of the above fixes work:

1. **Export your graph** (if you have data):
   - Settings → Export Graph
   - Save the JSON file as backup

2. **Completely reinstall:**
   ```
   1. Go to chrome://extensions/
   2. Remove "Autofill Graph"
   3. Restart Chrome
   4. Load extension again
   5. Configure API key
   6. Test with test-form.html
   ```

3. **Check Chrome version:**
   ```
   - Go to chrome://settings/help
   - Ensure Chrome version >= 100
   - Update if needed
   ```

4. **Check browser console:**
   ```
   - Look for red error messages
   - Copy the full error text
   - Check if it's a known issue
   ```

## Known Limitations

- ✗ Does not work on some JavaScript-heavy sites (React, Vue, Angular forms)
- ✗ Cannot detect forms in iframes
- ✗ Some custom input fields may not be recognized
- ✓ Works best on standard HTML forms (form, input, textarea, select)
- ✓ Test with test-form.html for guaranteed compatibility

## Success Checklist

Before reporting an issue, verify:

- [ ] Extension is loaded and active
- [ ] Extension has been reloaded
- [ ] API key is configured correctly
- [ ] Page has been refreshed
- [ ] Form fields are filled (for learning)
- [ ] Browser console shows no red errors
- [ ] Test-form.html works correctly
- [ ] Chrome version >= 100
- [ ] Internet connection is active
- [ ] Diagnostics script shows no errors

If all checks pass and issue persists, open an issue on GitHub with:
- Chrome version
- Steps to reproduce
- Screenshot of console errors
- Output from runDiagnostics()
