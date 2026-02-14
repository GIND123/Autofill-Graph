# Quick Testing Start

## 1. Setup (2 minutes)

```bash
# Install dependencies
npm install

# Verify tests can run
npm test -- --version
```

## 2. Your First Test (5 minutes)

### Chrome DevTools Method (No setup needed)

1. Go to `chrome://extensions`
2. Find "Privacy Graph Autofill" → Click "background page"
3. In console, run:

```javascript
import { GraphStorage } from './lib/graphStorage.js';

// Test data persistence
await GraphStorage.init();
const node = {
  id: 'test-1',
  type: 'skill',
  label: 'JavaScript',
  properties: {},
  metadata: { createdAt: Date.now(), confidence: 1.0 }
};
await GraphStorage.addNode(node);
const result = await GraphStorage.getNode('test-1');
console.log(result ? '✓ Test passed' : '✗ Test failed');
```

### Jest Method (Full test suite)

```bash
# Run all tests
npm test

# Run specific test file
npm test graphStorage.test.js

# Run with coverage report
npm test:coverage

# Watch mode (re-run on changes)
npm test:watch
```

## 3. Common Tests to Run

### Test 1: Form Detection
```javascript
// In content script console on any webpage
window.detectFormFields = () => {
  return document.querySelectorAll('input, textarea, select');
};
const fields = window.detectFormFields();
console.log(`Found ${fields.length} form fields`);
```

### Test 2: Semantic Analysis
```javascript
// In any page console
const field = document.querySelector('textarea[placeholder*="experience"]');
if (field) {
  import('./lib/semanticContextAnalyzer.js').then(m => {
    const context = m.SemanticContextAnalyzer.analyzeFieldContext(field);
    console.log('Intent:', context.intent);
    console.log('Strength:', context.semanticSignals.contextStrength);
  });
}
```

### Test 3: Graph Operations
```javascript
// In service worker console
import { GraphStorage } from './lib/graphStorage.js';
import { GraphQuery } from './lib/graphQuery.js';

// Check graph stats
const count = await GraphStorage.getStatistics();
console.log(`Graph has ${count.nodeCount} entities, ${count.edgeCount} relationships`);

// Verify fuzzy search works
const results = await GraphQuery.search('javascript', 0.7);
console.log('Search results:', results);
```

## 4. Manual Testing Checklist

Use this when testing on real websites:

- [ ] Extension loads (no red X on icon)
- [ ] Floating button appears on form pages
- [ ] Click button → modal shows
- [ ] Modal lists detected form fields
- [ ] Clicking field shows context analysis
- [ ] Suggestions appear (if graph has data)
- [ ] Can accept/edit/reject suggestions
- [ ] Feedback saved (check IndexedDB)

## 5. Quick Debugging

### Check if Extension Loaded

```javascript
// Type in ANY page console
typeof chrome.runtime  // Should print: "object"
```

### View All Stored Data

1. DevTools → Application tab
2. Left sidebar → IndexedDB → AutofillGraphDB
3. Click any object store (nodes, edges)
4. Right-click to delete test data

### Watch Network Activity

1. DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Perform autofill action
4. Should see 0 external API calls (all local)

### Monitor Performance

```javascript
// In console, measure autofill speed
console.time('autofill-suggestion');
// [Trigger autofill here]
console.timeEnd('autofill-suggestion');  // Shows ms elapsed
```

## 6. Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| Tests won't run | Run `npm install` first |
| Form fields not detected | Reload page, check not in iframe |
| No suggestions appear | Add test data: see TESTING_GUIDE.md Part 4 |
| Extension doesn't load | Go to chrome://extensions, reload project folder |
| Suggestions wrong | Check context analysis with debug code above |

## 7. Next: Create First Test File

Create `test/myFirstTest.js`:

```javascript
import { GraphStorage } from '../lib/graphStorage.js';

describe('My First Test', () => {
  test('database is responsive', async () => {
    await GraphStorage.init();
    expect(GraphStorage).toBeDefined();
  });
});
```

Run with: `npm test myFirstTest.js`

---

**See full guide**: [TESTING_GUIDE.md](TESTING_GUIDE.md)
