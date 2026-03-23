/**
 * Configuration File Template
 * Copy this file to config.js and add your API key
 *
 * INSTRUCTIONS:
 * 1. Copy this file: cp config.example.js config.js
 * 2. Edit config.js and replace YOUR_API_KEY_HERE with your actual key
 * 3. Reload the extension
 *
 * NOTE: config.js is in .gitignore and will NOT be committed
 */

const CONFIG = {
  // Set your Mistral API key here (get it from https://console.mistral.ai/api-keys/)
  MISTRAL_API_KEY: "YOUR_API_KEY_HERE",

  // Alternative: Leave empty to use manual entry in Settings tab
  // MISTRAL_API_KEY: "",
};

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
