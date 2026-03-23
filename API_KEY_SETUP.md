# Quick Setup Guide - API Key Configuration

## Two Ways to Set Your API Key

### Method 1: Using config.js (Recommended for Development)

**Advantages**: Automatic loading, no manual entry needed, persists across extension reloads

**Steps**:

1. **Copy the template**:
   ```bash
   cp config.example.js config.js
   ```

2. **Edit config.js** and add your API key:
   ```javascript
   const CONFIG = {
     MISTRAL_API_KEY: "your-actual-api-key-here",
   };
   ```

3. **Reload the extension** in chrome://extensions/

4. **Verify**: Open the extension popup and check the console. You should see:
   ```
   API key loaded from config.js
   API key configured ✓
   ```

**Note**: `config.js` is in `.gitignore` and will NOT be committed to version control. Your API key stays private!

### Method 2: Using Settings Tab (Original Method)

**Advantages**: No file editing needed, can change key easily

**Steps**:

1. Click the extension icon
2. Go to **Settings** tab
3. Paste your API key
4. Click **Save API Key**

## Priority System

The extension checks for API keys in this order:

1. **First**: `config.js` (if API key is set)
2. **Second**: Chrome storage (Settings tab)

If `config.js` has a valid key, it will always be used and saved to storage automatically.

## Getting Your API Key

1. Visit: https://console.mistral.ai/api-keys/
2. Create a free account
3. Click "Create API Key"
4. Copy the key (starts with "...")

## Troubleshooting

### "API key not found" message
- Check that `config.js` exists and has your key
- Make sure you copied from `config.example.js` correctly
- Verify the key doesn't have extra quotes or spaces
- Try reloading the extension

### "API key loaded from config.js" but still not working
- Verify your API key is valid at console.mistral.ai
- Check browser console for error messages
- Try the key manually in Settings tab to test it

### config.js changes not reflected
- Reload the extension in chrome://extensions/
- Check browser console for syntax errors in config.js
- Make sure CONFIG.MISTRAL_API_KEY value is a string in quotes

## Security Notes

- ✅ `config.js` is in `.gitignore` - your key won't be committed
- ✅ API key is stored in Chrome's encrypted storage
- ✅ Key is only sent to Mistral API (never to third parties)
- ⚠️ Don't share `config.js` or commit it to public repos
- ⚠️ Keep `config.example.js` as template (no real key in it)

## Example config.js

```javascript
const CONFIG = {
  MISTRAL_API_KEY: "sk_1a2b3c4d5e6f7g8h9i0j",  // Replace with your actual key
};
```

---

**Quick Start**: Just run `cp config.example.js config.js` and edit the file!
