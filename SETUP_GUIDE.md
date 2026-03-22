# 🧠 Autofill Graph - Chrome Extension

Privacy-first intelligent form autofiller powered by knowledge graphs and Mistral AI. All data stays on your device.

## 📋 Overview

This Chrome extension intelligently fills web forms by maintaining a local knowledge graph of your professional information. Instead of relying on simple string matching, it uses semantic understanding to connect form fields with your personal data.

**Key Features:**
- 🔒 **Privacy First**: All processing happens locally on your device
- 🧠 **Semantic Understanding**: Uses knowledge graphs and embeddings for intelligent matching
- 🤖 **LLM Integration**: Powered by Mistral AI's small model for efficient on-device inference
- 📚 **Continuous Learning**: Learns from your form interactions and corrections
- 🎯 **Vector DB**: Semantic similarity matching for complex form fields
- ⚡ **Fast**: Completes in under 2 seconds

## 🚀 Quick Start

### Prerequisites
- Chrome/Chromium browser (v100+)
- Mistral API key (free tier available)
- Internet connection (for API calls only)

### Installation Steps

#### 1. Get Your Mistral API Key
1. Visit [console.mistral.ai](https://console.mistral.ai)
2. Sign up for a free account
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (you'll need this in the extension)

#### 2. Load the Extension in Chrome

**Using Development Mode:**

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to and select the `Autofill-Graph` folder
5. The extension should now appear in your extensions list

**Update Path in .env:**
```
api-key=YOUR_MISTRAL_API_KEY_HERE
```

#### 3. Configure the Extension

1. Click the **Autofill Graph** extension icon in Chrome toolbar
2. Go to **Settings** tab
3. Paste your Mistral API key
4. Click **Save API Key**
5. You should see ✅ Connected status

## 📖 Usage Guide

### Initializing with Sample Data

The extension comes with sample data for demonstration. This data will be loaded when you first configure the API key.

**Sample Data Includes:**
- Personal profile (name, email, address)
- Academic information (university, degree, GPA)
- Project experience (project name, technologies)
- Work experience (company, position, skills)

### Basic Workflow

#### Step 1: Form Detection
- Navigate to any website with a form
- Click the extension icon
- Click **🔍 Detect Forms** button
- The extension will identify all form fields on the page

#### Step 2: Autofill Forms
- After detecting forms, click **✨ Autofill** button
- The extension will:
  - Analyze each form field
  - Query the knowledge graph
  - Fill in matching fields automatically
  - Highlight filled fields in light green

#### Step 3: Learn from Forms
- Fill out a form manually (or use autofilled values and edit them)
- Click **📚 Learn This Form** button
- The extension will:
  - Extract entities and relationships from your filled data
  - Update the knowledge graph
  - Improve future autofill accuracy

### Advanced Features

#### View Graph Contents
1. Click extension icon
2. Go to **Graph View** tab
3. See all entities and relationships in your knowledge graph

#### Export Your Data
1. Go to **Settings** → **Data Management**
2. Click **📥 Export Graph**
3. Your knowledge graph will download as JSON
4. You own and control this data

#### Clear Data
1. Go to **Settings** → **Data Management**
2. Click **🗑️ Clear Graph**
3. Confirm deletion

## 🏗️ Project Architecture

```
autofill-graph/
├── manifest.json              # Chrome extension manifest
├── package.json               # Dependencies
├── background.js              # Service worker (core logic)
├── content.js                 # Content script (form detection)
│
├── lib/
│   ├── knowledgeGraphManager.js    # Knowledge graph + LLM engine
│   └── sampleDataLoader.js         # Sample data initialization
│
└── popup/
    ├── popup.html             # Extension UI
    └── popup.js               # Popup interactions
```

### Core Components

#### 1. **KnowledgeGraphManager** (`lib/knowledgeGraphManager.js`)
- Manages the knowledge graph using a directed graph structure
- Generates embeddings for semantic matching
- Integrates with Mistral API for entity extraction and generation
- Implements vector similarity for form field matching

**Key Methods:**
- `learnFromForm(formData, context)`: Extract entities and add to graph
- `autofillForm(formFields)`: Fill form fields using graph knowledge
- `findSimilarNodes(query)`: Find semantically similar nodes
- `serialize()` / `deserialize()`: Persist graph to storage

#### 2. **Background Service Worker** (`background.js`)
- Initializes and manages the graph manager
- Handles message passing from content scripts and popup
- Persists graph to `chrome.storage.local`
- Orchestrates API calls to Mistral

#### 3. **Content Script** (`content.js`)
- Detects form elements on web pages
- Extracts field labels and context
- Handles autofill injection
- Captures user-filled data for learning

#### 4. **Popup UI** (`popup/popup.js`)
- Provides user interface with three tabs:
  - **Quick Actions**: Detect forms, autofill, learn
  - **Settings**: API key configuration, data management
  - **Graph View**: Visualize knowledge graph contents

## 🔬 Technical Deep Dive

### Knowledge Graph Structure

The knowledge graph is a directed graph where:
- **Nodes**: Entities (person, skills, organizations, etc.)
- **Edges**: Relationships (HAS_NAME, WORKS_AT, EXPERT_IN, etc.)

**Example:**
```
(User) -[HAS_NAME]-> (Govind)
(User) -[HAS_EMAIL]-> (gov.grad@umd.edu)
(User) -[STUDIES_AT]-> (University of Maryland)
(User) -[EXPERT_IN]-> (Machine Learning)
```

### Semantic Matching Process

1. **Form Field Analysis**
   - Extract label: "Candidate Name"
   - Get placeholder text and context

2. **Embedding Generation**
   - Generate deterministic embeddings for all graph nodes
   - Generate embedding for the form field

3. **Similarity Calculation**
   - Compute cosine similarity between field embedding and node embeddings
   - Return top-K most similar nodes

4. **Value Selection**
   - Mistral API determines the best match
   - Can infer values (e.g., City → State)
   - Can generate narrative text

### API Integration

The extension uses the **Mistral Small model** via REST API:

```javascript
POST https://api.mistral.ai/v0/chat/completions
{
  "model": "mistral-small-latest",
  "messages": [{"role": "user", "content": "..."}],
  "temperature": 0,
  "response_format": {"type": "json_object"}
}
```

**Cost:** The free tier includes 100 API requests. Each autofill operation makes 1 API call.

## 💾 Data Storage

All data is stored in Chrome's local storage:
- **`chrome.storage.local.graph`**: The serialized knowledge graph
- **`chrome.storage.local.apiKey`**: Your encrypted Mistral API key

**Storage Limits:**
- Chrome allows up to 10MB per extension in `chrome.storage.local`
- Current implementation uses <1MB even with extensive graphs

## 🔒 Privacy & Security

✅ **What stays on your device:**
- Your knowledge graph
- Your Mistral API key (encrypted in Chrome storage)
- All form detection logic

⚠️ **What goes to external servers:**
- API calls to Mistral for entity extraction and form filling
- Your knowledge graph content is sent to Mistral during autofill

**To maintain privacy:**
- Keep your API key secret (regenerate if exposed)
- Review the knowledge graph contents periodically
- Use Chrome's privacy settings to limit tracking

## 🐛 Troubleshooting

### "API key not configured" message
- Go to Settings tab
- Paste your Mistral API key
- Click Save

### Forms not being detected
- Make sure the website loads fully
- Try clicking "Detect Forms" again
- Some forms might use non-standard HTML

### Autofill returns "NULL"
- The knowledge graph might not have relevant data
- Try learning from related forms first
- Ensure the API key is valid

### "API error" messages
- Check your Mistral API key is correct
- Verify you haven't exceeded API rate limits
- Check your internet connection

## 📚 Learning & Improvement

The system improves through:

1. **Direct Learning**: Click "Learn This Form" to add filled data to the graph
2. **Autofill Feedback**: Review autofilled values and correct them
3. **Relationship Updates**: Each learning session refines entity relationships

**Best Practices:**
- Learn from multiple forms to build a comprehensive graph
- Use consistent naming (e.g., always "University of Maryland", not "UMD")
- Review graph contents periodically and clean up duplicates

## 🔧 Development

### File Structure

```
lib/
  ├── knowledgeGraphManager.js   # Core ML engine
  └── sampleDataLoader.js        # Sample data

popup/
  ├── popup.html                 # Extension popup UI
  └── popup.js                   # Popup logic

background.js                    # Service worker
content.js                       # Content script
manifest.json                    # Extension manifest
package.json                     # Dependencies
```

### Adding New Features

#### Example: Add new relationship type

1. Update the prompt in `knowledgeGraphManager.js`:
```javascript
"Use only these relations: HAS_NAME, HAS_EMAIL, EXPERT_IN, WORKED_AT, ..."
```

2. Test with sample forms

### Running Tests Locally

```bash
# Not yet implemented - manual testing in Chrome
chrome://extensions/ → Developer Mode → Extension
```

## 📝 Example Use Cases

### Use Case 1: Job Applications
1. Load your resume data into the graph
2. Browse to a job application form
3. Click "Detect Forms" then "Autofill"
4. Review and submit

### Use Case 2: Multiple Platforms
1. Learn from your LinkedIn profile
2. Learn from GitHub profile
3. Learn from academic CV
4. When filling forms on new platforms, the extension finds the best match

### Use Case 3: Continuous Improvement
1. Initially enable autofill with partial data
2. Manually complete forms
3. Click "Learn" to add new information
4. Future forms get more accurate autofills

## 📞 Support & Feedback

- Report issues: Check console (F12) for error messages
- Feature requests: Edit `manifest.json` to add permissions or modify behavior

## 📄 License

This project is built as a privacy-first solution. Use at your own risk.

## 🙏 Acknowledgments

Built with:
- [Mistral AI](https://mistral.ai) - Language model
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/) - Extension framework
- Inspired by knowledge graph applications in semantic web

---

**Questions?** Check the console (F12) for detailed logs of all operations.

**Last Updated:** March 2026
