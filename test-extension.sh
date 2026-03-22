#!/bin/bash
# Test script for Autofill Graph extension

echo "Testing Autofill Graph Extension Setup"
echo "========================================"
echo ""

# Check if all required files exist
echo "1. Checking required files..."
files=(
  "manifest.json"
  "background.js"
  "content.js"
  "package.json"
  "popup/popup.html"
  "popup/popup.js"
  "lib/knowledgeGraphManager.js"
  "lib/sampleDataLoader.js"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "   [OK] $file"
  else
    echo "   [FAIL] $file - NOT FOUND"
    all_exist=false
  fi
done

echo ""
echo "2. Checking manifest.json validity..."
if grep -q '"manifest_version": 3' manifest.json; then
  echo "   [OK] Manifest V3 format"
else
  echo "   [FAIL] Not Manifest V3"
fi

if grep -q 'background.js' manifest.json; then
  echo "   [OK] Service worker configured"
else
  echo "   [FAIL] Service worker not found in manifest"
fi

if grep -q 'content.js' manifest.json; then
  echo "   [OK] Content script configured"
else
  echo "   [FAIL] Content script not found in manifest"
fi

echo ""
echo "3. Checking API key configuration..."
if grep -q "api-key=" .env; then
  echo "   [OK] API key configured in .env"
else
  echo "   [FAIL] API key not found in .env"
fi

echo ""
echo "4. Checking core library..."
if grep -q "class KnowledgeGraphManager" lib/knowledgeGraphManager.js; then
  echo "   [OK] Knowledge graph manager class found"
else
  echo "   [FAIL] Knowledge graph manager class not found"
fi

if grep -q "generateSimpleEmbedding" lib/knowledgeGraphManager.js; then
  echo "   [OK] Embedding function found"
else
  echo "   [FAIL] Embedding function not found"
fi

if grep -q "cosineSimilarity" lib/knowledgeGraphManager.js; then
  echo "   [OK] Similarity function found"
else
  echo "   [FAIL] Similarity function not found"
fi

echo ""
echo "5. Checking form detection..."
if grep -q "class FormDetector" content.js; then
  echo "   [OK] Form detector class found"
else
  echo "   [FAIL] Form detector class not found"
fi

if grep -q "detectForms" content.js; then
  echo "   [OK] Form detection method found"
else
  echo "   [FAIL] Form detection method not found"
fi

echo ""
echo "6. Checking popup UI..."
if grep -q "class PopupUI" popup/popup.js; then
  echo "   [OK] Popup UI class found"
else
  echo "   [FAIL] Popup UI class not found"
fi

if grep -q "Quick Actions" popup/popup.html; then
  echo "   [OK] UI tabs configured"
else
  echo "   [FAIL] UI tabs not found"
fi

echo ""
echo "7. Checking for emojis (should be clean)..."
emoji_count=$(find . -type f \( -name "*.js" -o -name "*.html" -o -name "*.md" \) ! -path "./.git/*" ! -path "./.venv/*" ! -path "./node_modules/*" -exec grep -l '[^\x00-\x7F]' {} \; 2>/dev/null | wc -l)
if [ "$emoji_count" -eq 0 ]; then
  echo "   [OK] No non-ASCII characters found"
else
  echo "   [WARN] Found $emoji_count files with non-ASCII characters"
fi

echo ""
echo "========================================"
if [ "$all_exist" = true ]; then
  echo "Status: READY FOR DEPLOYMENT"
  echo ""
  echo "Next steps:"
  echo "1. Open chrome://extensions/ in Chrome"
  echo "2. Enable Developer mode"
  echo "3. Click 'Load unpacked'"
  echo "4. Select this folder"
  echo "5. Configure API key in Settings tab"
  echo "6. Test on any website with forms"
else
  echo "Status: SOME FILES MISSING"
  echo "Please check the failures above"
fi
