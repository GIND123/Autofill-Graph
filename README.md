# Autofill-Graph

An intelligent Chrome extension that uses graph-based learning and semantic analysis to provide context-aware form autofill suggestions.

## Overview

Autofill-Graph is a next-generation form autofill system that goes beyond traditional autocomplete. It uses a knowledge graph to understand relationships between data, learns from user behavior, and provides intelligent suggestions based on semantic context.

## Features

- **Graph-Based Learning**: Builds a knowledge graph from user data and interactions
- **Semantic Context Analysis**: Understands form context and field relationships
- **Intelligent Entity Extraction**: Automatically extracts and categorizes information
- **LLM Integration**: Uses language models for advanced text understanding
- **Narrative Generation**: Creates human-readable explanations for suggestions
- **Feedback Learning**: Improves accuracy based on user feedback
- **Privacy-Focused**: All data stored locally in Chrome storage

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Chrome browser

### Setup

1. Clone the repository:
```bash
git clone https://github.com/GIND123/Autofill-Graph.git
cd Autofill-Graph
```

2. Install dependencies:
```bash
npm install
```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `Autofill-Graph` directory

## Project Structure

```
Autofill-Graph/
├── manifest.json           # Chrome extension manifest
├── background.js           # Background service worker
├── content.js             # Content script for page interaction
├── popup/                 # Extension popup UI
│   ├── popup.js
│   └── graphDB.js
├── lib/                   # Core library modules
│   ├── documentParser.js          # Parse and analyze documents
│   ├── entityExtraction.js        # Extract entities from text
│   ├── feedbackManager.js         # Handle user feedback
│   ├── graphLearning.js           # Graph learning algorithms
│   ├── graphQuery.js              # Query the knowledge graph
│   ├── graphStorage.js            # Persist graph data
│   ├── llmManager.js              # LLM integration
│   ├── narrativeGenerator.js      # Generate explanations
│   ├── semanticContextAnalyzer.js # Analyze semantic context
│   ├── semanticMatcher.js         # Match suggestions to context
│   └── utils.js                   # Utility functions
├── test/                  # Test files
└── scripts/               # Setup and utility scripts
```

## How It Works

1. **Document Analysis**: The extension analyzes web page structure and form fields
2. **Entity Extraction**: Extracts relevant entities from user input and page content
3. **Graph Building**: Creates and updates a knowledge graph with relationships
4. **Context Analysis**: Understands the semantic context of forms
5. **Smart Suggestions**: Provides intelligent autofill suggestions based on graph data
6. **Feedback Loop**: Learns from user interactions to improve accuracy

## Development

### Running Tests

```bash
npm test
```

Or use the test runner:
```bash
./test-runner.sh
```

### Documentation

- [Quick Start Guide](QUICK_START.md)
- [Testing Guide](TESTING_GUIDE.md)
- [Technical Roadmap](TECHNICAL_ROADMAP.md)
- [Implementation Status](IMPLEMENTATION_STATUS.md)

## Technologies Used

- **Chrome Extension API**: Browser integration
- **JavaScript/ES6**: Core programming language
- **Jest**: Testing framework
- **Graph Algorithms**: Knowledge representation
- **Semantic Analysis**: NLP techniques
- **Local Storage**: Chrome storage API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]

## Roadmap

- ✅ Core graph storage and learning
- ✅ Entity extraction system
- ✅ Semantic context analysis
- ✅ Feedback management
- 🔄 LLM integration
- 🔄 Advanced narrative generation
- 📋 Multi-language support
- 📋 Cloud sync (optional)

## Privacy

All data is stored locally on your device. No information is sent to external servers unless you explicitly configure LLM integration.

## Support

For issues, questions, or contributions, please open an issue on GitHub.