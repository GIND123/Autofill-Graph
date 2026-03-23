# Testing Prototype2 Implementation

## Quick Fix Applied

Fixed compatibility issue where `background.js` was using old Prototype1 API:
- Changed `graphManager.graph.size` → `graphManager.entities.size`
- Changed `graphManager.edges` → `graphManager.relations`
- Updated `createFallbackGraph()` to use Prototype2 structure with `storeAttribute()` and `storeInference()`
- Updated deserialization checks to look for `entities` instead of `nodes`

## How to Test

### Step 1: Reload the Extension

1. Open `chrome://extensions/`
2. Find "Autofill Graph" extension
3. Click the **reload** button (circular arrow icon)
4. Check for errors in the console

### Step 2: Open Extension Popup

1. Click the extension icon in the toolbar
2. Popup should open without errors
3. You should see 4 tabs: **Quick Actions**, **Insights**, **Settings**, **Graph View**

### Step 3: Run Diagnostic Test

1. Right-click on the popup window
2. Select **Inspect** to open DevTools
3. Go to the **Console** tab
4. Type or paste:
   ```javascript
   // Load the test script
   fetch(chrome.runtime.getURL('test-prototype2.js'))
     .then(r => r.text())
     .then(code => eval(code));
   ```
5. Check the test results - all should show ✓

### Step 4: Test Learning (Core Feature)

1. Open `test-form.html` in your browser
2. Fill out the form with:
   - **Name**: Your name
   - **Email**: Use a `.edu` domain if possible (e.g., `john@umd.edu`)
   - **Phone**: Use country code (e.g., `+1-301-555-0100`)
   - **Address**: Full address with city, state, zip (e.g., `123 Main St, College Park, MD 20740`)
3. Click the extension icon
4. Click **"Learn This Form"**
5. Wait for success message

**Expected Results:**
- Success message appears
- Console shows "Learning from form with data: ..."
- Console shows inferred facts:
  - University inferred from email domain
  - Country inferred from phone prefix
  - City, state, zip parsed from address

### Step 5: Check Insights Tab

1. Open extension popup
2. Click **"Insights"** tab
3. Should see three sections:

**Inferred Facts:**
- Should show university from email (e.g., "University of Maryland")
- Should show country from phone (e.g., "USA")
- Should show city, state, zip from address
- Each with confidence levels and source facts

**Temporal History:**
- If you've only learned once, will show "No temporal changes detected"
- Learn from another form with different address to see history

**Privacy Breakdown:**
- Should show count of PUBLIC facts
- Should show 0 RESTRICTED and ENCRYPTED (unless you added medical data)

### Step 6: Test Two-Phase Autofill

1. Open a new tab with a different form (or reload test-form.html)
2. Click extension icon
3. Click **"Autofill"**
4. Open browser console (F12)
5. Look for messages:
   - "Phase 1 (Local): Filled X/Y fields"
   - "Phase 2 (LLM): Filled Z/Y remaining fields" (if API key configured)

**Expected Results:**
- Fields should auto-fill with your data
- Most fields filled in Phase 1 (local, instant)
- Only complex/missing fields use Phase 2 (LLM, if available)
- Stats show `local_fills` and `api_fills`

### Step 7: Check Enhanced Statistics

1. Go to **Quick Actions** tab
2. Look at **Graph Status** section
3. Should see:
   - **Entities**: Number of entities (should be > 0)
   - **Relationships**: Number of relations
   - **Facts (Current)**: Currently valid facts
   - **Facts (Inferred)**: Automatically inferred facts
   - **Local Fills**: Count of local autofills
   - **API Fills**: Count of LLM-assisted fills
   - **API Calls**: Total API requests
   - **Ready to Autofill**: "✓ Yes" if enough data

### Step 8: Test Field Mapping

Create a form with unusual field names (copy to HTML file):
```html
<form>
  <label>Candidate Full Name: <input type="text" name="candidate_name"></label><br>
  <label>Contact Email Address: <input type="text" name="contact_email"></label><br>
  <label>Alma Mater: <input type="text" name="alma_mater"></label><br>
  <label>Current Employer: <input type="text" name="current_company"></label><br>
  <button type="submit">Submit</button>
</form>
```

1. Open this form
2. Click **"Autofill"**
3. Verify all fields are filled correctly:
   - "Candidate Full Name" should map to your name
   - "Contact Email Address" should map to your email
   - "Alma Mater" should map to your university
   - "Current Employer" should map to employer (if you provided it)

**This tests the FieldMapper's 100+ alias support!**

### Step 9: Test Privacy Filtering

1. Create a form with medical info:
   ```html
   <form>
     <label>Insurance Provider: <input type="text" name="insurance"></label><br>
     <label>Blood Type: <input type="text" name="blood_type"></label><br>
     <label>Allergies: <input type="text" name="allergies"></label><br>
   </form>
   ```
2. Fill with fake medical data
3. Click **"Learn This Form"**
4. Check **Insights → Privacy Breakdown**
5. Should see **RESTRICTED** count increase

### Step 10: Test Temporal Updates

1. Fill test-form.html with an address
2. Click **"Learn This Form"**
3. Change the address field to a different address
4. Click **"Learn This Form"** again
5. Go to **Insights → Temporal History**
6. Should see both addresses with different timestamps
7. Current address should be marked "(current)"
8. Old address should be marked "(expired)" or shown with validity period

## Expected Console Messages

### On Extension Load:
```
Extension initialized successfully
Graph status: 1 entities, 0 relations
Starting with empty graph. Use 'Learn This Form' to add your data.
```

### On Learning:
```
Learning from form with data: {email: "john@umd.edu", ...}
Learned 5 facts (3 inferred)
Saving graph after learning...
Graph saved successfully
```

### On Autofill:
```
Autofilling 5 fields...
Phase 1 (Local): Filled 4/5 fields
Phase 2 (LLM): Filled 1/5 remaining fields
Total filled: 5/5 fields
```

## Troubleshooting

### Error: "Cannot read properties of undefined"
- **Fixed!** This was the original error. Reload the extension.

### "No inferences yet" in Insights tab
- You need to learn from a form with email (`.edu` domain) or phone (+country code)
- Deterministic resolvers only work with recognized patterns

### "Phase 1 filled 0 fields"
- Graph might be empty - learn from a form first
- Field names might not match - check FieldMapper aliases
- Verify data was actually stored (check Graph Status)

### "API error" messages
- Check API key is configured in Settings
- Verify internet connection
- Check Mistral API status page

### Autofill doesn't work
- Ensure you've learned from at least one form
- Check Graph Status shows facts > 0
- Try "Detect Forms" first to verify form is detected
- Check browser console for detailed error messages

## Verification Checklist

- [ ] Extension loads without errors
- [ ] All 4 tabs appear (Quick Actions, Insights, Settings, Graph View)
- [ ] Can learn from forms successfully
- [ ] Inferred facts appear in Insights tab (university, country, city, state, zip)
- [ ] Privacy breakdown shows correct sensitivity levels
- [ ] Two-phase autofill works (Phase 1 local, Phase 2 LLM)
- [ ] Enhanced statistics display correctly
- [ ] Field mapping handles unusual field names
- [ ] Temporal history tracks changes
- [ ] Privacy filtering works for RESTRICTED data

## Success Criteria

✅ **All features working** if:
1. No errors in console 2. Learning extracts and infers facts correctly
3. Autofill fills fields using local matching first
4. Insights tab shows inferred facts, history, and privacy
5. Statistics track all operations
6. Field mapper handles 100+ variations

## Next Steps After Testing

If all tests pass:
1. ✅ Prototype2 is fully implemented and working
2. 🎉 Extension is ready for real-world use
3. 📝 Consider adding more test cases for edge cases
4. 🚀 Consider adding more universities to EMAIL_DOMAIN_MAP
5. 🌍 Consider adding more countries to PHONE_COUNTRY_MAP

If tests fail:
1. Check browser console for specific errors
2. Verify you reloaded the extension after changes
3. Clear extension storage and try again: `chrome.storage.local.clear()`
4. Check that all files were updated correctly
5. Report issues with console error messages

---

**Status**: Ready for testing
**Version**: 2.0.0
**Date**: March 23, 2026
