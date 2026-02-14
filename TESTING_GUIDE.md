# Testing Guide - Privacy Graph Autofill

# Table of Contents
1. Unit Testing
2. Integration Testing
3. Manual Testing
4. Test Data Setup
5. Debugging Guide

---

## Part 1: Unit Testing

### Prerequisites
```bash
# Install Jest (if not already installed globally)
npm install -g jest

# Or locally in project
npm install --save-dev jest
```

### Test GraphStorage

**File: test/graphStorage.test.js**

```javascript
import { GraphStorage } from '../lib/graphStorage.js';

describe('GraphStorage', () => {
  beforeEach(async () => {
    await GraphStorage.init();
    await GraphStorage.clear();
  });

  test('should create and retrieve a node', async () => {
    const node = {
      id: 'node-1',
      type: 'skill',
      label: 'JavaScript',
      properties: { level: 'expert' },
      metadata: { createdAt: Date.now(), confidence: 1.0 }
    };

    await GraphStorage.addNode(node);
    const retrieved = await GraphStorage.getNode('node-1');

    expect(retrieved).toEqual(node);
  });

  test('should search nodes by label', async () => {
    const node = {
      id: 'node-2',
      type: 'skill',
      label: 'React Framework',
      properties: {},
      metadata: { createdAt: Date.now(), confidence: 0.8 }
    };

    await GraphStorage.addNode(node);
    const results = await GraphStorage.searchNodesByLabel('React');

    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('React Framework');
  });

  test('should create and retrieve edges', async () => {
    const node1 = {
      id: 'role-1',
      type: 'role',
      label: 'Senior Engineer',
      properties: {},
      metadata: { createdAt: Date.now(), confidence: 1.0 }
    };
    const node2 = {
      id: 'skill-1',
      type: 'skill',
      label: 'JavaScript',
      properties: {},
      metadata: { createdAt: Date.now(), confidence: 1.0 }
    };

    await GraphStorage.addNode(node1);
    await GraphStorage.addNode(node2);

    const edge = {
      id: 'edge-1',
      source: 'role-1',
      target: 'skill-1',
      type: 'hasSkill',
      properties: { weight: 1.0 },
      metadata: { inferred: false, confidence: 1.0 }
    };

    await GraphStorage.addEdge(edge);
    const outgoing = await GraphStorage.getOutgoing('role-1');

    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].type).toBe('hasSkill');
  });
});
```

### Test GraphQuery

**File: test/graphQuery.test.js**

```javascript
import { GraphStorage } from '../lib/graphStorage.js';
import { GraphQuery } from '../lib/graphQuery.js';

describe('GraphQuery', () => {
  beforeEach(async () => {
    await GraphStorage.init();
    await GraphStorage.clear();
  });

  test('should search with fuzzy matching', async () => {
    const node = {
      id: 'skill-1',
      type: 'skill',
      label: 'Node.js',
      properties: {},
      metadata: { createdAt: Date.now(), confidence: 1.0 }
    };

    await GraphStorage.addNode(node);
    const results = await GraphQuery.search('nodejs', 0.6);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toBe('Node.js');
  });

  test('should find related nodes via BFS', async () => {
    // Create a chain: role -> skill -> technology
    const role = {
      id: 'role-1',
      type: 'role',
      label: 'Developer',
      properties: {},
      metadata: { createdAt: Date.now(), confidence: 1.0 }
    };
    const skill = {
      id: 'skill-1',
      type: 'skill',
      label: 'JavaScript',
      properties: {},
      metadata: { createdAt: Date.now(), confidence: 1.0 }
    };
    const tech = {
      id: 'tech-1',
      type: 'tech_skill',
      label: 'React',
      properties: {},
      metadata: { createdAt: Date.now(), confidence: 1.0 }
    };

    await GraphStorage.addNode(role);
    await GraphStorage.addNode(skill);
    await GraphStorage.addNode(tech);

    const edge1 = {
      id: 'edge-1',
      source: 'role-1',
      target: 'skill-1',
      type: 'hasSkill',
      properties: {},
      metadata: { inferred: false, confidence: 1.0 }
    };
    const edge2 = {
      id: 'edge-2',
      source: 'skill-1',
      target: 'tech-1',
      type: 'relatedTo',
      properties: {},
      metadata: { inferred: false, confidence: 1.0 }
    };

    await GraphStorage.addEdge(edge1);
    await GraphStorage.addEdge(edge2);

    const related = await GraphQuery.findRelated('role-1', 2);

    // Should find both skill and tech
    expect(related).toContain('skill-1');
    expect(related).toContain('tech-1');
  });
});
```

### Test SemanticContextAnalyzer

**File: test/semanticContextAnalyzer.test.js**

```javascript
import { SemanticContextAnalyzer } from '../lib/semanticContextAnalyzer.js';

describe('SemanticContextAnalyzer', () => {
  let mockElement;

  beforeEach(() => {
    // Create a mock form field
    mockElement = document.createElement('input');
    mockElement.id = 'experience-field';
    mockElement.name = 'experience';
    mockElement.type = 'textarea';
    mockElement.placeholder = 'Describe your professional experience';
    mockElement.setAttribute('aria-label', 'Professional Experience');

    // Add to document for testing
    document.body.appendChild(mockElement);
  });

  afterEach(() => {
    document.body.removeChild(mockElement);
  });

  test('should analyze text field context', () => {
    const context = SemanticContextAnalyzer.analyzeFieldContext(mockElement);

    expect(context).toBeDefined();
    expect(context.directContext).toBeDefined();
    expect(context.intent).toBeDefined();
    expect(context.expectedEntityTypes).toBeDefined();
  });

  test('should detect professional narrative intent', () => {
    mockElement.setAttribute('aria-label', 'Describe a time you demonstrated leadership');
    mockElement.placeholder = 'Tell us about a leadership challenge you overcame';

    const context = SemanticContextAnalyzer.analyzeFieldContext(mockElement);

    expect(context.intent).toBe('professional_narrative');
  });

  test('should detect email field type', () => {
    const emailField = document.createElement('input');
    emailField.type = 'email';
    emailField.placeholder = 'your@email.com';
    document.body.appendChild(emailField);

    const context = SemanticContextAnalyzer.analyzeFieldContext(emailField);

    expect(context.expectedEntityTypes).toContain('email');

    document.body.removeChild(emailField);
  });
});
```

---

## Part 2: Integration Testing

### Test Full Autofill Pipeline

**File: test/autofill.integration.test.js**

```javascript
import { GraphStorage } from '../lib/graphStorage.js';
import { EntityExtractor } from '../lib/entityExtraction.js';
import { SemanticMatcher } from '../lib/semanticMatcher.js';

describe('Autofill Pipeline Integration', () => {
  beforeEach(async () => {
    await GraphStorage.init();
    await GraphStorage.clear();
  });

  test('should complete resume ingestion to form matching', async () => {
    // Step 1: Create sample entity
    const node = {
      id: 'skill-1',
      type: 'skill',
      label: 'JavaScript',
      properties: { category: 'programming' },
      metadata: { createdAt: Date.now(), confidence: 1.0 }
    };
    await GraphStorage.addNode(node);

    // Step 2: Create form field
    const field = {
      id: 'field-1',
      label: 'List your programming skills',
      type: 'textarea',
      context: { placeholder: 'e.g., JavaScript, Python...' }
    };

    // Step 3: Match field to entity
    const suggestion = await SemanticMatcher.suggestForField(field);

    expect(suggestion).toBeDefined();
    expect(suggestion.fieldId).toBe('field-1');
    expect(suggestion.sourceNode).toBeDefined();
  });
});
```

---

## Part 3: Manual Testing

### Step 1: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `/Users/hacxmr/Documents/GitHub/Autofill-Graph` directory
5. You should see the extension loaded

### Step 2: Test Form Detection

1. **Visit a test form**: Go to a website with a form (e.g., example.com/form)
2. **Check floating button**: Look for blue "Autofill" button in bottom-right corner
3. **Open DevTools**: Press F12, go to "Console" tab
4. **Test field detection** by running:

```javascript
// In browser console on any form
const inputs = document.querySelectorAll('input, textarea, select');
console.log(`Found ${inputs.length} form fields`);
Array.from(inputs).forEach(input => {
  console.log(`- ${input.id}: ${input.type} (${input.placeholder || input.name})`);
});
```

### Step 3: Test Context Analysis

```javascript
// In browser console
import { SemanticContextAnalyzer } from './lib/semanticContextAnalyzer.js';

const field = document.querySelector('textarea');
if (field) {
  const context = SemanticContextAnalyzer.analyzeFieldContext(field);
  console.log('Field Intent:', context.intent);
  console.log('Entity Types:', context.expectedEntityTypes);
  console.log('Context Strength:', context.semanticSignals.contextStrength);
}
```

### Step 4: Test Graph Operations

```javascript
// In Service Worker console
import { GraphStorage } from './lib/graphStorage.js';

// Initialize
await GraphStorage.init();

// Add test node
const testNode = {
  id: 'test-skill-1',
  type: 'skill',
  label: 'Test Skill',
  properties: {},
  metadata: { createdAt: Date.now(), confidence: 1.0 }
};
await GraphStorage.addNode(testNode);

// Retrieve it
const retrieved = await GraphStorage.getNode('test-skill-1');
console.log('Retrieved:', retrieved);

// Search
const results = await GraphStorage.searchNodesByLabel('Test');
console.log('Search results:', results);
```

---

## Part 4: Test Data Setup

### Create Sample Resume Data

**File: test/sampleData.js**

```javascript
export const sampleResume = `
JOHN SMITH
john.smith@email.com | (555) 123-4567

PROFESSIONAL SUMMARY
Experienced Software Engineer with 5+ years developing Web Applications using JavaScript, React, and Node.js.

EXPERIENCE

Senior Software Engineer - Tech Corp (2021-Present)
- Led team of 5 engineers developing customer portal
- Implemented React-based dashboard with real-time updates
- Improved API performance by 40% through optimization
- Technologies: React, Node.js, PostgreSQL, Docker, AWS

Software Engineer - StartUp Inc (2019-2021)
- Built full-stack web applications using MERN stack
- Designed microservices architecture
- Mentored 2 junior developers
- Technologies: JavaScript, MongoDB, Express, React, Node.js

Junior Developer - Digital Agency (2018-2019)
- Developed client websites using HTML, CSS, JavaScript
- Assisted in fixing production bugs
- Technologies: JavaScript, jQuery, PHP

SKILLS
Programming Languages: JavaScript, Python, Java
Frontend: React, Vue.js, HTML5, CSS3
Backend: Node.js, Express, Django
Databases: PostgreSQL, MongoDB, Redis
DevOps: Docker, Kubernetes, GitHub Actions, AWS, GCP
Other: Git, REST APIs, Microservices, Agile/Scrum

EDUCATION
Bachelor of Science in Computer Science
State University (2018)
GPA: 3.8

CERTIFICATIONS
- AWS Solutions Architect Associate
- Kubernetes Administrator (CKA)
`;

export const sampleFormFields = [
  {
    id: 'name',
    label: 'Full Name',
    type: 'text',
    placeholder: 'Enter your full name'
  },
  {
    id: 'email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'your@email.com'
  },
  {
    id: 'experience',
    label: 'Describe your professional experience',
    type: 'textarea',
    placeholder: 'Tell us about your background...'
  },
  {
    id: 'skills',
    label: 'What are your key technical skills?',
    type: 'textarea',
    placeholder: 'List programming languages, frameworks, tools...'
  },
  {
    id: 'leadership',
    label: 'Give an example of a time you led a team',
    type: 'textarea',
    placeholder: 'Describe the situation, actions, and results...'
  }
];
```

### Load Sample Data in Extension

```javascript
// In background.js or Service Worker console
import { GraphStorage } from './lib/graphStorage.js';
import { EntityExtractor } from './lib/entityExtraction.js';
import { sampleResume } from './test/sampleData.js';

// Setup
await GraphStorage.init();

// Simulate resume processing
const resumeBlob = new Blob([sampleResume], { type: 'text/plain' });
const resumeFile = new File([resumeBlob], 'resume.txt');

try {
  const result = await EntityExtractor.processResume(resumeFile);
  console.log('Resume processed:', result);
  console.log(`Created ${result.nodesCreated} nodes, ${result.edgesCreated} edges`);
} catch (error) {
  console.error('Error:', error);
}
```

---

## Part 5: Debugging Guide

### Access Browser DevTools for Content Script

1. Right-click on any web page → "Inspect" or press F12
2. Go to "Console" tab
3. You can now debug content script directly

### Access DevTools for Service Worker

1. Go to `chrome://extensions`
2. Find "Privacy Graph Autofill"
3. Click "background page" link
4. New DevTools window opens for service worker
5. Set breakpoints and debug

### Common Testing Scenarios

#### Scenario 1: Check if Extension Loads

```javascript
// In any page console
console.log(typeof chrome.runtime);  // Should print "object"
chrome.runtime.sendMessage({ test: true }, response => {
  console.log('Background response:', response);
});
```

#### Scenario 2: Test Message Passing

```javascript
// In content script console
chrome.runtime.sendMessage(
  {
    type: 'GET_GRAPH_CONTEXT',
    data: {}
  },
  response => {
    console.log('Graph context:', response);
  }
);
```

#### Scenario 3: Inspect IndexedDB

1. Open DevTools (F12)
2. Go to "Application" tab
3. Left sidebar → "IndexedDB" → "AutofillGraphDB"
4. View stored nodes and edges
5. Right-click to delete entries

#### Scenario 4: Monitor Storage

```javascript
// In Service Worker console
const data = await chrome.storage.local.get();
console.log('All stored data:', data);

// Get specific key
const feedback = await chrome.storage.local.get('autofill_feedback_history');
console.log('Feedback history:', feedback);
```

### Breakpoint Debugging

**File: content.js**

```javascript
// Add breakpoint before form detection
function requestAutofill() {
  debugger;  // Execution pauses here
  const fields = detectFormFields();
  // ...
}
```

**File: background.js**

```javascript
// Add breakpoint in message handler
async function handleAutofillRequest(request, sender) {
  debugger;  // Execution pauses here
  const formFields = request.data || [];
  // ...
}
```

### Performance Testing

```javascript
// Measure autofill suggestion time
console.time('autofill');
const suggestions = await SemanticMatcher.suggestForFields(fields);
console.timeEnd('autofill');  // Logs elapsed ms

// Check graph size
const context = await GraphStorage.getFullContext();
console.log(`Graph contains ${context.nodes.length} nodes, ${context.edges.length} edges`);
console.log(`Estimated size: ${JSON.stringify(context).length} bytes`);
```

---

## Testing Checklist

### Unit Tests
- [ ] GraphStorage CRUD operations (create, read, search, delete)
- [ ] GraphQuery traversal and search
- [ ] SemanticContextAnalyzer DOM analysis
- [ ] Entity extraction and parsing
- [ ] Feedback recording and statistics

### Integration Tests
- [ ] Resume ingestion → graph population
- [ ] Form detection → field analysis → suggestion generation
- [ ] Feedback loop → graph updates

### Manual Tests
- [ ] Extension loads without errors
- [ ] Floating button appears on all pages
- [ ] Form fields detected correctly
- [ ] Context analysis shows correct intent
- [ ] Suggestions appear in modal
- [ ] User can edit suggestions
- [ ] Feedback is recorded
- [ ] Graph improves over time (second autofill more accurate)

### Performance Tests
- [ ] Field detection < 100ms
- [ ] Suggestion generation < 2 seconds
- [ ] Graph storage handles 1000+ entities
- [ ] Memory usage stays reasonable

### Privacy Tests
- [ ] No external API calls visible
- [ ] All data stays in IndexedDB
- [ ] Data persists after extension reload
- [ ] User can export/clear data

---

## Troubleshooting

### Extension not loading
- Check manifest.json for syntax errors
- Ensure all file paths are correct
- Check Chrome version supports MV3

### Form fields not detected
- Check content.js loaded on page
- Verify form uses standard HTML input elements
- Check for iframe context issues

### Suggestions not appearing
- Check service worker console for errors
- Verify graph has data (IndexedDB)
- Check SemanticMatcher receives field data

### Slow performance
- Check IndexedDB size (DevTools → Application)
- Verify GraphQuery not traversing too deep
- Profile with Chrome DevTools Performance tab

---

## Next Steps for Testing

1. Run unit tests: `jest`
2. Manually test on sample forms
3. Load real resumes and test with actual job application forms
4. Measure performance with Chrome Dev Tools
5. Test on different websites and form structures
6. Collect feedback and iterate
