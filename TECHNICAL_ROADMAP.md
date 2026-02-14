# Technical Roadmap & Implementation Guide

## Architecture Overview (Target State)

```
┌─────────────────────────────────────────────────────────────┐
│                  Chrome Extension (MV3)                     │
├──────────────────────┬──────────────────────┬───────────────┤
│  Content Script      │  Background Worker   │   Popup UI    │
│  (content.js)        │  (background.js)     │  (popup.html) │
├──────────────────────┼──────────────────────┼───────────────┤
│ • DOM Observer       │ • Message Router     │ • Resume      │
│ • Form Detection     │ • Inference Manager  │   Upload      │
│ • Field Scraping     │ • Graph Query Engine │ • Settings    │
│ • Visual Feedback    │ • LLM Orchestration  │ • Data Mgmt   │
└──────────────────────┴──────────────────────┴───────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Semantic Engine    │
                    ├─────────────────────┤
                    │ • Entity Matching   │
                    │ • Graph Traversal   │
                    │ • Text Generation   │
                    │ • Feedback Learning │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Local Storage      │
                    ├─────────────────────┤
                    │ • Knowledge Graph   │
                    │ • Feedback History  │
                    │ • Entity Cache      │
                    │ • Settings          │
                    └─────────────────────┘
```

---

## Core Data Structures (Required)

### 1. Knowledge Graph Schema

```javascript
// Entity Types
const EntityTypes = {
  SKILL: 'skill',           // JavaScript, Leadership, etc.
  ROLE: 'role',             // Senior Engineer, Project Manager
  ORGANIZATION: 'org',      // Company name, Institution
  PROJECT: 'project',       // Project/Work item
  ACHIEVEMENT: 'achievement', // Awards, recognitions
  EDUCATION: 'education',   // Degrees, certifications
  TECHNICAL_SKILL: 'tech_skill',
  SOFT_SKILL: 'soft_skill'
};

// Node Structure
interface GraphNode {
  id: string;               // UUID
  type: EntityType;         // One of EntityTypes
  label: string;            // Display name
  description?: string;     // Additional context
  properties: {
    [key: string]: any;     // Type-specific data
  };
  metadata: {
    createdAt: number;      // Timestamp
    source: string;         // 'resume', 'user_input', 'inferred'
    confidence: number;     // 0-1 confidence score
    frequency: number;      // Times auto-filled/used
  };
}

// Edge/Relationship Structure
interface GraphEdge {
  id: string;               // UUID
  source: string;           // Source node ID
  target: string;           // Target node ID
  type: RelationType;       // e.g., 'hasSkill', 'workedAt'
  properties?: {
    weight: number;         // Relationship strength (0-1)
    context: string;        // Why are these connected?
  };
  metadata: {
    inferred: boolean;      // ML-generated vs user-provided
    confidence: number;     // 0-1 confidence
    updatedAt: number;
  };
}

// Relationship Types
const RelationTypes = {
  HAS_SKILL: 'hasSkill',
  WORKED_AT: 'workedAt',
  LED_TEAM: 'ledTeam',
  USED_TECHNOLOGY: 'usedTechnology',
  ACHIEVED: 'achieved',
  RELATED_TO: 'relatedTo',
  DEMONSTRATES: 'demonstrates',  // Skill demonstrates outcome
  REQUIRES: 'requires'           // Project requires skill
};
```

### 2. Form Field Schema

```javascript
interface FormField {
  id: string;                    // HTML id or name
  label: string;                 // Extracted label text
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox'; 
  context: {
    placeholder?: string;
    helperText?: string;
    instructions?: string;
    validationRules?: string;
    proximity: string[];         // Surrounding field labels
  };
  semanticAnalysis: {
    keywords: string[];          // key terms extracted
    intent: string;              // 'personal_info' | 'experience' | 'narrative'
    entityTypes: string[];       // Expected entity types
  };
  suggestions?: Array<{
    text: string;
    confidence: number;
    source: string[];            // Which nodes/edges used
  }>;
}
```

### 3. Feedback Schema

```javascript
interface UserFeedback {
  id: string;
  formUrl: string;
  fieldId: string;
  originalSuggestion: string;
  userEdit: string;           // What user actually submitted
  feedback: 'correct' | 'partially_correct' | 'incorrect' | 'ignored';
  timestamp: number;
  impactAnalysis: {
    affectedNodes: string[];  // Nodes used in suggestion
    updateActions: string[];  // What should change in graph
  };
}
```

---

## Implementation Checklist

### Phase 1: Knowledge Graph Foundation

#### 1.1 Create Graph Storage Module (lib/graphStorage.js)
- [ ] Implement IndexedDB wrapper for graph storage
- [ ] Create node CRUD operations
- [ ] Create edge CRUD operations
- [ ] Implement entity indexing for fast lookup
- [ ] Add transaction support for bulk operations
- [ ] Implement simple query methods (by type, by label)
- [ ] Add data export/import for backup

#### 1.2 Build Graph Query Engine (lib/graphQuery.js)
- [ ] Implement graph traversal (BFS, DFS)
- [ ] Create relevance filtering based on field context
- [ ] Implement entity search with fuzzy matching
- [ ] Create subgraph extraction for narrative questions
- [ ] Add relationship chain analysis

#### 1.3 Document Parsing Pipeline (lib/documentParser.js)
- [ ] Integrate PDF.js for PDF extraction
- [ ] Add DOCX parsing (JSZip + XML parsing)
- [ ] Implement plain text parsing
- [ ] Create text chunking strategy
- [ ] Build initial NER (Named Entity Recognition) using regex + heuristics
- [ ] Create entity deduplication logic

#### 1.4 Entity Extraction Engine (lib/entityExtraction.js)
- [ ] Build resume/document-to-entity mapper
- [ ] Create entity property extractors (dates, tech skills, etc.)
- [ ] Implement relationship inference logic
- [ ] Build entity validation and deduplication
- [ ] Create timeline/chronology inference

### Phase 2: Semantic Intelligence

#### 2.1 Semantic Matcher (lib/semanticMatcher.js)
- [ ] Implement field intent classification
- [ ] Create entity-to-field mapping logic
- [ ] Build context similarity scoring
- [ ] Implement fallback matching strategies
- [ ] Add support for custom field patterns

#### 2.2 Narrative Generator (lib/narrativeGenerator.js)
- [ ] Implement graph traversal for context gathering
- [ ] Build narrative templates for common questions
- [ ] Create response synthesis logic
- [ ] Implement length-aware generation
- [ ] Add tone/style adaptation

#### 2.3 LLM Integration (lib/llmManager.js)
- [ ] Wrap Chrome AI API with error handling
- [ ] Implement prompt engineering strategies
- [ ] Add response parsing and validation
- [ ] Create fallback for when API unavailable
- [ ] Build prompt templating system

### Phase 3: Feedback & Learning

#### 3.1 Feedback Collection (lib/feedbackManager.js)
- [ ] Create feedback storage schema
- [ ] Implement feedback capture from popup
- [ ] Build impact analysis logic
- [ ] Create suggested graph updates from feedback

#### 3.2 Graph Learning (lib/graphLearning.js)
- [ ] Implement entity weight updates
- [ ] Build relationship confidence refinement
- [ ] Create new node inference from feedback
- [ ] Implement relationship discovery
- [ ] Add frequency tracking for confidence

#### 3.3 UI Components (popup/components/)
- [ ] Create review modal for autofill suggestions
- [ ] Build feedback form (correct/incorrect/partial)
- [ ] Create data import/export UI
- [ ] Build settings panel
- [ ] Create knowledge graph visualizer (optional, advanced)

### Phase 4: Security & Optimization

#### 4.1 Data Security (lib/encryption.js)
- [ ] Implement encryption-at-rest using TweetNaCl or similar
- [ ] Create key derivation from master password
- [ ] Build secure deletion for sensitive data
- [ ] Implement permission-based access control

#### 4.2 Performance (lib/performance.js)
- [ ] Add response time monitoring
- [ ] Create caching layer for frequent queries
- [ ] Optimize graph traversal algorithms
- [ ] Implement batch processing
- [ ] Add lazy loading for large graphs

#### 4.3 Testing & Validation
- [ ] Unit tests for graph operations
- [ ] Integration tests for document parsing
- [ ] E2E tests for autofill workflow
- [ ] Performance benchmarks
- [ ] Privacy audit

---

## File Structure (Target)

```
autofill-graph/
├── manifest.json
├── background.js                 (simplified orchestrator)
├── content.js                    (improved form detection)
│
├── lib/
│   ├── graphStorage.js          (NEW)
│   ├── graphQuery.js            (NEW)
│   ├── documentParser.js        (NEW)
│   ├── entityExtraction.js      (NEW)
│   ├── semanticMatcher.js       (NEW)
│   ├── narrativeGenerator.js    (NEW)
│   ├── llmManager.js            (NEW)
│   ├── feedbackManager.js       (NEW)
│   ├── graphLearning.js         (NEW)
│   ├── encryption.js            (NEW)
│   ├── performance.js           (NEW)
│   ├── utils.js                 (NEW - helpers)
│   └── graphDB.js               (refactor)
│
├── popup/
│   ├── popup.html               (improve)
│   ├── popup.js                 (refactor)
│   ├── popup.css                (NEW)
│   └── components/
│       ├── reviewModal.html     (NEW)
│       ├── feedbackForm.html    (NEW)
│       ├── settingsPanel.html   (NEW)
│       └── graphVisualizer.html (NEW - optional)
│
├── assets/
│   └── styles.css               (NEW - shared styles)
│
├── tests/
│   ├── graphStorage.test.js     (NEW)
│   ├── entityExtraction.test.js (NEW)
│   └── ...
│
└── IMPLEMENTATION_ANALYSIS.md   (THIS FILE)
```

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "pdf.js": "^3.11.174",           // PDF extraction
    "jszip": "^3.10.1",              // DOCX parsing
    "uuid": "^9.0.0",                // ID generation
    "jest": "^29.5.0",               // Testing
    "tweetnacl-js": "^1.4.0"        // Encryption (optional, can use native crypto)
  }
}
```

Note: Most dependencies should be bundled into background service worker or popup. Content scripts have size constraints.

---

## Quick Start: First Implementation (Week 1)

### Day 1-2: Graph Storage
```javascript
// lib/graphStorage.js skeleton
export class GraphStorage {
  static async init() { /* Initialize IndexedDB */ }
  static async addNode(node) { /* Store node */ }
  static async getNode(id) { /* Retrieve node */ }
  static async addEdge(edge) { /* Store relationship */ }
  static async queryByType(type) { /* Find all entities of type */ }
  static async queryByLabel(label) { /* Search by name */ }
}
```

### Day 3: Document Parser
```javascript
// lib/documentParser.js skeleton
export class DocumentParser {
  static async parsePDF(file) { /* Extract text from PDF */ }
  static async parseDOCX(file) { /* Extract text from DOCX */ }
  static async extractStructure(text) { /* Find sections, entities */ }
}
```

### Day 4-5: Entity Extraction
```javascript
// lib/entityExtraction.js skeleton
export class EntityExtractor {
  static async extract(resumeText) { 
    // Return array of GraphNode objects with relationships
  }
  static inferRelationships(entities) {
    // Create edges between related entities
  }
}
```

### Day 6-7: Integration & Testing
- Hook document parser to popup
- Connect entity extraction to graph storage
- Test end-to-end resume ingestion

---

## Success Criteria

### Minimum Viable Product (MVP)
1. User can upload resume
2. System extracts skills, roles, organizations
3. Knowledge graph stores relationships
4. Form fields are detected with context
5. Simple field-to-entity matching works
6. User reviews and provides feedback
7. Feedback updates graph confidence scores

### Production Readiness
1. All user data encrypted at rest
2. Autofill operations complete <2 seconds
3. Supports PDF, DOCX, plain text
4. Handles narrative questions
5. Comprehensive error handling
6. >90% accuracy on standard form fields
7. >70% accuracy on narrative fields

---

## Known Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Chrome AI API unavailable | Can't infer/generate | Implement fallback using regex templates |
| Graph size exceeds 10MB | App breaks | Implement incremental sync, pruning |
| Semantic matching fails | Wrong field mapping | Provide manual mapping UI, confidence thresholds |
| Encryption overhead | Performance degradation | Use native Crypto API, async operations |
| PDF parsing memory spike | Content script crash | Parse in background, chunk processing |

---

## Next Immediate Steps

1. **Review this analysis** - Identify any misalignments with your vision
2. **Design graph schema** - Create detailed TypeScript/JSDoc definitions
3. **Start Phase 1.1** - Implement IndexedDB-backed graph storage
4. **Plan sprints** - Allocate 2-week sprints for each phase
5. **Set up testing** - Add Jest/testing framework now
6. **Prototype semantic matching** - Experiment with similarity approaches

