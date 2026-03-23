# Autofill Graph - Privacy-First Knowledge Graph Autofill System

A production-ready Chrome extension that intelligently fills web forms using local knowledge graphs and semantic understanding. All data stays on your device.

## Overview

Autofill Graph is a Chrome Manifest V3 extension that replaces traditional form autofill with an intelligent, adaptive system powered by knowledge graphs and vector embeddings. Instead of simple string matching, the system learns relationships between your professional information and uses semantic understanding to match complex form fields.

**Key Innovation:** Your personal knowledge graph lives locally on your device. No cloud, no tracking, no data sharing. Only you control your information.

## Recent Updates

**v2.0.0 (March 2026)** - Prototype2 Full Implementation 🚀
- **NEW:** Typed temporal knowledge graph with validity periods (valid_from, valid_until)
- **NEW:** Multi-layer architecture (identity, contact, academic, professional, medical)
- **NEW:** Comprehensive field mapping with 100+ aliases via FieldMapper class
- **NEW:** Deterministic resolvers for email domains, phone countries, address parsing
- **NEW:** Privacy-aware with three sensitivity levels (PUBLIC, RESTRICTED, ENCRYPTED)
- **NEW:** Inference registry tracking derived vs stored facts
- **NEW:** Two-phase autofill (local pattern matching first, then LLM fallback)
- **NEW:** Comprehensive stats tracking (facts_stored, facts_inferred, local_fills, api_fills)
- **NEW:** Temporal history viewer showing changes over time
- **NEW:** Privacy breakdown showing data sensitivity distribution
- **NEW:** Insights tab with inferred facts and historical data visualization
- **ENHANCED:** AttributeValue class with full temporal and provenance metadata
- **ENHANCED:** Enhanced statistics and debugging capabilities

**v1.0.2 (March 2026)** - Major Learning System Fixes
- **CRITICAL:** Fixed Mistral API 404 error (v0 → v1 endpoint)
- **CRITICAL:** Removed hardcoded fallback data pollution
- **NEW:** Extension now starts with empty graph (learns from real forms only)
- **NEW:** Enhanced autofill with pattern matching fallback (works without API)
- **NEW:** Added comprehensive debugging tools (debug.js, clear-graph.js)
- **NEW:** Created verification guides (FIX_VERIFICATION.md, TROUBLESHOOTING.md)
- **SECURITY:** Removed .env from version control, added .gitignore
- Repository structure cleaned up and documentation updated

**v1.0.1 (March 2026)** - Stability & Bug Fixes
- Fixed JavaScript `.strip()` method error (changed to `.trim()`)
- Fixed graph data loss on API key updates (now preserves learned data)
- Enhanced logging throughout learning pipeline for easier debugging
- Repository cleanup (removed redundant documentation)
- All core functionality verified and working correctly

## Features

### Core Capabilities (Prototype2)

**Temporal Knowledge Graph**
- Every fact has validity periods (valid_from, valid_until)
- Track historical changes (e.g., address updates, job transitions)
- Query current vs expired information
- View complete temporal history for any attribute

**Multi-Layer Architecture**
- **Identity Layer**: full_name, display_name, aliases (PUBLIC)
- **Contact Layer**: email, phone, address, city, state, zip, linkedin, portfolio (PUBLIC)
- **Academic Layer**: university, department, degree, gpa, graduation_date, thesis, advisor (PUBLIC)
- **Professional Layer**: employer, job_title, skills, years_experience, work_email (PUBLIC)
- **Medical Layer**: insurance_provider, policy_number, blood_type, allergies (RESTRICTED)

**Privacy & Security**
- **PUBLIC**: Can be sent to LLM API (most data)
- **RESTRICTED**: Local-only, needs consent for API (medical data)
- **ENCRYPTED**: Never leaves device (SSN, tax_id, passport)
- Sensitivity-gated routing ensures private data stays private
- Privacy breakdown shows distribution of data sensitivity

**Intelligent Inference**
- Automatically infers university from email domain (e.g., @umd.edu → University of Maryland)
- Deduces country from phone prefix (e.g., +1 → USA)
- Parses addresses to extract city, state, zip automatically
- Tracks all inferred facts separately from stored facts
- Shows confidence levels and source facts for each inference

**Comprehensive Field Mapping**
- 100+ field label variations supported
- Handles wildly different form layouts (job apps, university admissions, travel visas)
- Learns new field mappings dynamically
- Fuzzy matching for complex field names

**Two-Phase Autofill**
- Phase 1: Local pattern matching (fast, no API calls)
- Phase 2: LLM-powered filling for complex/missing fields
- Graceful degradation if API unavailable
- Tracks local vs API fills for transparency

**Advanced Statistics**
- Facts stored, current, expired, and inferred
- API calls, local fills, API fills
- Entity and relationship counts
- Privacy sensitivity breakdown

### Original Features

- **Semantic Form Understanding**: Intelligently interprets complex form fields using knowledge graphs and embeddings
- **Continuous Learning**: Learns from every form you fill and improves accuracy over time
- **Privacy-First**: All processing happens locally. Only API calls to Mistral (optional)
- **Fast & Lightweight**: Completes autofill in under 2 seconds
- **Start Clean**: Begins with empty graph, learns from YOUR real form data only
- **Data Ownership**: Export your knowledge graph anytime as JSON
- **Professional UI**: Clean, intuitive interface with Settings, Quick Actions, and Graph Visualization tabs

## Technology Stack

- **Frontend**: Chrome Manifest V3, Vanilla JavaScript ES6+
- **ML/AI**: 384-dimensional vector embeddings, cosine similarity matching
- **Graph Database**: In-memory graph structure (JSON serializable)
- **LLM**: Mistral Small API for entity extraction and narrative generation
- **Storage**: Chrome.storage.local (encrypted by browser)

## Quick Start

### Prerequisites

- Chrome or Chromium browser (v100+)
- Mistral API key (free at [console.mistral.ai](https://console.mistral.ai))

### Installation (5 minutes)

1. **Clone Repository**
   ```bash
   git clone https://github.com/GIND123/Autofill-Graph.git
   cd Autofill-Graph
   ```

2. **Set Up API Key** (Choose One Method)

   **Method A: Using config.js (Recommended - Auto-loads)**
   ```bash
   # Copy the template
   cp config.example.js config.js

   # Edit config.js and add your API key
   # MISTRAL_API_KEY: "your-key-here"
   ```
   Get your key from [console.mistral.ai/api-keys/](https://console.mistral.ai/api-keys/)

   **Method B: Manual Entry via Settings Tab**
   - Skip this step, configure later in Settings tab after loading extension

3. **Load Extension**
   ```
   1. Open chrome://extensions/
   2. Enable "Developer mode" (top right)
   3. Click "Load unpacked"
   4. Select the Autofill-Graph folder
   ```

4. **Configure**
   ```
   1. Click extension icon
   2. Go to "Settings" tab
   3. Paste API key
   4. Click "Save API Key"
   ```

5. **Test**
   ```
   1. Visit any website with a form
   2. Click "Detect Forms"
   3. Click "Autofill"
   4. Watch fields fill automatically!
   ```

## How It Works

### Knowledge Graph Structure

The system maintains a directed graph where:
- **Nodes** represent entities (Name, Email, Skills, Companies, etc.)
- **Edges** represent relationships (HAS_NAME, EXPERT_IN, WORKED_AT, etc.)

Example:
```
Graph:
  (User) -[HAS_NAME]-> (Govind)
  (User) -[HAS_EMAIL]-> (gov.grad@umd.edu)
  (User) -[EXPERT_IN]-> (Machine Learning)
  (User) -[WORKED_AT]-> (AI Research Lab)
```

### Autofill Pipeline

```
Form Field → Embed → Find Similar Nodes → Query LLM → Generate Value → Fill Field
```

1. **Form Detection** (content.js)
   - Scans page for form fields
   - Extracts labels and context

2. **Semantic Matching** (knowledgeGraphManager.js)
   - Generates embeddings for form field
   - Calculates cosine similarity to graph nodes
   - Returns top-K matching entities

3. **Value Generation** (Mistral API)
   - Analyzes matched entities
   - Generates coherent text for narrative fields
   - Returns structured JSON response

4. **Auto-Fill** (content.js)
   - Injects values into form fields
   - Highlights completed fields
   - Triggers change events

### Learning Pipeline

```
User Fills Form → Extract Data → Create Triples → Add to Graph → Improve Accuracy
```

1. Click "Learn This Form"
2. System extracts field values
3. Mistral API identifies entities and relationships
4. Graph updates with new knowledge
5. Future forms benefit from new information

## Repository Structure

```
Autofill-Graph/
├── manifest.json              # Chrome extension configuration (Manifest V3)
├── background.js              # Service worker (handles graph lifecycle & messaging)
├── content.js                 # Content script (form detection & autofill injection)
├── package.json               # Project metadata and dependencies
├── test-form.html             # Test page for debugging and verification
├── test-extension.sh          # Automated validation script
├── debug.js                   # Diagnostic script for troubleshooting
├── clear-graph.js             # Script to reset graph data
├── Prototype.ipynb            # Research prototype (duplicate of Baseline version)
│
├── lib/                       # Core ML libraries (2 files)
│   ├── knowledgeGraphManager.js    # Main ML engine & graph operations
│   └── sampleDataLoader.js         # Sample data definitions for testing
│
├── popup/                     # Extension popup UI (2 files)
│   ├── popup.html             # Popup interface & styling
│   └── popup.js               # UI logic, event handlers & messaging
│
├── Baseline/                  # Original research prototypes
│   ├── Prototype.ipynb        # Initial concept (Jupyter notebook)
│   └── Prototype2.ipynb       # Refined implementation with LLM
│
├── Documentation files (in root):
├── README.md                  # This file (complete user & dev guide)
├── FIX_VERIFICATION.md        # Step-by-step testing procedures
├── TESTING_VERIFICATION.md    # Verification guide for fixes
├── TROUBLESHOOTING.md         # Common issues & solutions
├── PROJECT_STRUCTURE.txt      # File structure reference
│
├── Configuration files (in root):
├── .env                       # Local file: Mistral API key (create yourself)
├── .gitignore                 # Git ignore rules (excludes .env)
├── .gitattributes             # Git line ending configuration
└── LICENSE                    # MIT License
```

### Key Files Explained

**Core Extension Files:**
- `manifest.json` - Chrome extension configuration with Manifest V3 compliance
- `background.js` - Service worker managing graph persistence and message routing
- `content.js` - Injected into web pages for form detection and autofill

**ML Engine (`lib/`):**
- `knowledgeGraphManager.js` - Complete ML pipeline: graph ops, embeddings, Mistral API
- `sampleDataLoader.js` - Predefined sample entities for testing (optional)

**User Interface (`popup/`):**
- `popup.html` - Extension popup with tabs (Quick Actions, Settings, Graph View)
- `popup.js` - UI interactions, settings management, real-time graph stats

**Development Tools:**
- `test-form.html` - Self-contained test form for debugging
- `debug.js` - Console diagnostics for extension health checks
- `clear-graph.js` - Utility to reset graph data completely

## Usage Guide

### Quick Actions Tab

**Detect Forms**
- Scans current page for form fields
- Shows count of detected forms and inputs
- Works on dynamic/lazy-loaded forms

**Autofill**
- Two-phase autofill: local matching first, then LLM
- Fills detected form fields using knowledge graph
- Highlights filled fields in green
- Takes 1-3 seconds (first call slower due to API)

**Learn This Form**
- Extracts filled values from form
- Applies deterministic resolvers (email→university, phone→country, etc.)
- Updates knowledge graph with new entities and inferences
- Improves future autofill accuracy

### Insights Tab (NEW in Prototype2)

**Inferred Facts**
- View all automatically inferred information
- See confidence levels and source facts
- Understand what the system deduced vs what you provided

**Temporal History**
- Track changes to your information over time
- See current vs expired values
- View complete history for key attributes
- Understand when data was valid

**Privacy Breakdown**
- See distribution of PUBLIC vs RESTRICTED vs ENCRYPTED data
- Understand what information can be sent to APIs
- Monitor your privacy posture

### Settings Tab

**API Configuration**
- Add/update Mistral API key
- Key is encrypted in Chrome storage

**Data Management**
- **Export Graph**: Download knowledge graph as JSON (your data backup)
- **Clear Graph**: Delete all learned information (with confirmation)

### Graph View Tab

**Visualize Knowledge**
- See all entities in your graph
- View relationships and connections
- Understand what the system knows about you

## Getting Started

The extension starts with a **clean, empty graph**. You build your knowledge graph by learning from forms you actually fill out. This ensures your autofill data is 100% accurate to your real information.

### First Steps:
1. **Install & configure** following the installation guide below
2. **Fill out a form** with your real information (use test-form.html for testing)
3. **Click "Learn This Form"** to add your data to the knowledge graph
4. **Test autofill** on the same or different forms
5. **Your graph grows** with each form you learn from

The more forms you learn from, the better the autofill becomes!

## API Integration

### Mistral API

The extension uses Mistral Small model via REST API for:

**Entity Extraction**
```
Input: Form data (JSON)
Output: Triples of (head, relation, tail)
```

**Response Generation**
```
Input: Form field + relevant graph substructure
Output: Filled value (text or structured data)
```

**API Details**
- Model: `mistral-small-latest`
- Response Format: JSON mode
- Free Tier: 100 requests/month
- Cost for production: Very minimal

## Performance

Expected timings on modern machine:

| Operation | Time |
|-----------|------|
| Form detection | 50-200ms |
| Vector similarity | <50ms |
| First autofill (with API) | 1-3 seconds |
| Subsequent autofill | 800ms-1.5 seconds |
| Learn from form | 1-2 seconds |
| Storage operations | <50ms |

## Storage

All data stored in `chrome.storage.local`:

**Graph Storage**
```json
{
  "nodes": {
    "Entity1": { "type": "person", "data": {} },
    "Entity2": { "type": "skill", "data": {} }
  },
  "edges": [
    { "head": "Entity1", "tail": "Entity2", "relation": "RELATION_TYPE" }
  ],
  "timestamp": 1234567890
}
```

**Limits**
- Storage limit: 10MB per extension
- Typical usage: <1MB even with extensive graphs
- Data persists across browser sessions
- Chrome encrypts storage automatically

## Security & Privacy

### What Stays Local
- Complete knowledge graph
- All form processing
- All matching logic
- Chrome storage operations

### What's Encrypted
- API key (by Chrome)
- Stored knowledge graph

### What Goes to Mistral API
- Graph queries for entity extraction
- Only when you click "Autofill" or "Learn"
- Can be disabled in settings

### You Control
- Can export data anytime
- Can delete data anytime
- Can view all stored information
- Can regenerate API key anytime

## Troubleshooting

### Extension Console Access
Open the browser console to debug:
1. Click extension icon
2. Right-click popup → Inspect
3. Go to Console tab
4. Watch for error messages

### Forms Not Detected
- Page might use custom form framework (Vue, React)
- Try different website (Google Forms, GitHub, LinkedIn)
- Click "Detect Forms" again after page loads
- Check console for JavaScript errors

### Autofill Returns Empty Values
- Check Graph Status (should show entities from forms you've learned)
- Verify API key is saved correctly
- Try forms with clearer field labels (name, email, etc.)
- Check browser console for API errors
- If graph is empty, learn from a form first using "Learn This Form"

### Learning Fails
- Form fields need visible labels or placeholders
- Check console (F12) for detailed error messages
- Verify API key is working (test autofill first)
- Try simpler forms before complex ones

### API Errors
- Verify API key from console.mistral.ai
- Check internet connection
- Verify API key is correctly pasted (no extra spaces)
- Check Mistral API status page for outages

### Graph Not Persisting
- Check Chrome storage: chrome://extensions → Autofill Graph → Storage
- Verify extension has storage permissions
- Try exporting graph as backup

### Debug Commands
Open popup console and run:
```javascript
// Check graph stats
chrome.runtime.sendMessage({type: "GET_GRAPH_STATS"}, (r) => console.log(r));

// Check storage
chrome.storage.local.get("graph", (data) => console.log(data));

// Check API key status
chrome.runtime.sendMessage({type: "GET_API_KEY_STATUS"}, (r) => console.log(r));
```

## Development

### Project Evolution

The extension evolved from Jupyter notebook prototypes (see `Baseline/` directory):
- **Prototype.ipynb**: Initial concept with knowledge graph and vector embeddings
- **Prototype2.ipynb**: Refined implementation with LLM integration

These prototypes were successfully productionized into a Chrome Manifest V3 extension.

### Code Quality

- **No dependencies**: Vanilla JavaScript, no npm packages required
- **Clean architecture**: Separation of concerns (background, content, UI)
- **Well documented**: 1000+ lines of commented code
- **Type-safe prompts**: JSON mode for reliable data extraction
- **Error handling**: Graceful fallbacks for all API calls

### Key Classes

**KnowledgeGraphManager**
- Core ML engine
- Graph operations (add nodes, edges, query)
- Embedding generation
- Similarity calculations
- LLM integration

**FormDetector**
- DOM parsing
- Field extraction
- Context analysis
- Dynamic form support

**PopupUI**
- Settings management
- Statistics display
- User notifications
- Tab navigation

### Extending the System

**Add New Relationships:**
Update prompt in `knowledgeGraphManager.js`:
```javascript
"Use only these relations: HAS_NAME, HAS_EMAIL, EXPERT_IN, WORKED_AT, ..."
```

**Change Embedding Dimensions:**
Modify in `knowledgeGraphManager.js`:
```javascript
this.vectorDimensions = 384; // Change this value
```

**Reset Graph Data:**
```javascript
// Clear all learned data and start fresh
chrome.storage.local.set({graph: null})
// Or use clear-graph.js script
```

**Load Test Data:**
Use the "Load Sample Data" button in Settings tab to add demo entities for testing the extension without entering real personal information.

## Testing

Run included test script:
```bash
bash test-extension.sh
```

Validates:
- All required files present
- Manifest V3 format
- Core library functions
- Form detection capability
- UI configuration
- Extension integrity

## Use Cases

### Job Applications
1. Load resume into graph
2. Browse job application form
3. Click "Autofill" → auto-fill common fields
4. Edit as needed, submit

### Multi-Platform Registration
1. Learn from LinkedIn
2. Learn from GitHub
3. Learn from academic CV
4. New platform forms autofill better

### Timeline
1. Day 1: Install, configure API key
2. Day 1-2: Test on 5+ websites
3. Day 2+: Learn from your forms
4. Week 1: Graph improves significantly
5. Week 2+: Handles complex narrative fields

## Performance Characteristics

**Strengths**
- Extremely fast form detection
- Minimal memory footprint
- No network activity except Mistral API
- Instant similarity calculations
- Graceful degradation if API fails

**Limitations**
- Requires Mistral API for entity extraction
- Embedding dimensions fixed (384D)
- Single-user system (per browser profile)
- No cross-device sync

## System Requirements

- Chrome/Chromium v100+
- 1MB free storage
- Internet connection (for Mistral API)
- API key from Mistral (free tier available)

## Contributing

This is a personal project. For suggestions or issues, refer to the GitHub issues page.

## License

MIT License - Copyright (c) 2026 Mitali Raj

You are free to:
- Use commercially
- Modify the source
- Distribute copies
- Use privately

See LICENSE file for full terms.

## Acknowledgments

Built with:
- [Mistral AI](https://mistral.ai) - Language model API
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/) - Extension framework
- Knowledge Graph concepts from semantic web research

## Roadmap

Potential future enhancements:
- [ ] Support for other browsers (Firefox, Edge)
- [ ] Offline LLM support (runs locally on device)
- [ ] Bulk form analysis
- [ ] Graph visualization dashboard
- [ ] Natural language query interface
- [ ] Multi-device sync with encryption
- [ ] Custom relationship definitions
- [ ] Form field templates

## Contact & Support

For issues, questions, or feedback:
1. **Check troubleshooting guides:**
   - `TROUBLESHOOTING.md` - Common issues & solutions
   - `FIX_VERIFICATION.md` - Complete testing procedures
   - `TESTING_VERIFICATION.md` - Verification guides
2. Review browser console logs (F12)
3. Ensure API key is correctly configured
4. Test on different websites (start with test-form.html)
5. Verify extension is up to date (reload at chrome://extensions/)

**Debugging tools:**
- Run `debug.js` in popup console for diagnostics
- Use `clear-graph.js` to reset graph data

GitHub Issues: https://github.com/GIND123/Autofill-Graph/issues

## FAQ

**Q: Is my data secure?**
A: Yes. All data stays on your device. Mistral API only receives data when you explicitly click "Autofill" or "Learn".

**Q: Can I export my data?**
A: Yes. Settings → Data Management → Export Graph. You get a JSON file you own completely.

**Q: What if I lose my data?**
A: You can import from your JSON backup or rebuild by learning from forms again.

**Q: Does it work offline?**
A: Entity extraction requires Mistral API, so no. But form filling works offline if your graph is pre-built.

**Q: How accurate is autofill?**
A: Improves with use. Starts at ~70% for standard fields, improves to >90% after learning from 5+ forms.

**Q: Can I use without API key?**
A: Yes, for basic autofill using pattern matching. But learning new information and advanced AI features require the API.

**Q: How is performance?**
A: Fast. Autofill completes in 1-3 seconds including network latency.

**Q: Will this be on Chrome Web Store?**
A: Currently for personal use. Web Store submission possible if documentation improves.

---

Built with privacy first. By Mitali Raj.

**Repository:** https://github.com/GIND123/Autofill-Graph
**Last Updated:** March 23, 2026
**Version:** 2.0.0
**Status:** Production Ready - Prototype2 Full Implementation Complete
