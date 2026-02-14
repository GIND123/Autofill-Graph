/**
 * Content Script - Form detection and autofill UI
 * Analyzes DOM for form fields and manages user interactions
 */

/**
 * Detect form fields and collect metadata about them
 */
function detectFormFields() {
  const fields = [];
  const inputs = document.querySelectorAll('input, textarea, select');

  for (const element of inputs) {
    // Skip hidden fields and certain types
    if (element.hidden || element.type === 'hidden' || element.type === 'submit' || element.type === 'button') {
      continue;
    }

    const field = {
      id: element.id || element.name || `field-${Date.now()}-${Math.random()}`,
      name: element.name,
      label: extractFieldLabel(element),
      type: element.type || 'text',
      context: {
        placeholder: element.placeholder,
        helperText: extractHelperText(element),
        instructions: extractInstructions(element),
        value: element.value
      }
    };

    fields.push(field);
  }

  return fields;
}

/**
 * Extract label text for a form field
 */
function extractFieldLabel(element) {
  // Try explicit label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.innerText || label.textContent;
  }

  // Try parent fieldset legend
  const fieldset = element.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) return legend.innerText || legend.textContent;
  }

  // Try aria-label
  if (element.ariaLabel) return element.ariaLabel;

  // Use title or name as fallback
  return element.title || element.name || element.placeholder || '';
}

/**
 * Extract helper/description text
 */
function extractHelperText(element) {
  // Look for small/help text near the field
  const parent = element.closest('div, fieldset, form');
  if (!parent) return '';

  const helpText = parent.querySelector('[class*="help"], [class*="hint"], [class*="description"]');
  if (helpText) return helpText.innerText || helpText.textContent;

  return '';
}

/**
 * Extract field instructions (aria-describedby, etc)
 */
function extractInstructions(element) {
  if (element.ariaDescribedBy) {
    const descElement = document.getElementById(element.ariaDescribedBy);
    if (descElement) return descElement.innerText || descElement.textContent;
  }

  return '';
}

/**
 * Request autofill suggestions from background worker
 */
function requestAutofill() {
  const fields = detectFormFields();

  if (fields.length === 0) {
    showNotification('No form fields detected on this page');
    return;
  }

  // Show loading state
  const btn = document.querySelector('[data-autofill-button]');
  if (btn) btn.disabled = true;

  showNotification('Analyzing form and generating suggestions...');

  chrome.runtime.sendMessage(
    { type: 'AUTOFILL_REQUEST', data: fields },
    (response) => {
      if (btn) btn.disabled = false;

      if (response.error) {
        showNotification(`Error: ${response.error}`, 'error');
        return;
      }

      if (response.suggestions && response.suggestions.length > 0) {
        displaySuggestions(response.suggestions, fields);
      } else {
        showNotification('No suggestions could be generated', 'info');
      }
    }
  );
}

/**
 * Display suggestions to user for review
 */
function displaySuggestions(suggestions, allFields) {
  // Create modal for reviewing suggestions
  const modal = document.createElement('div');
  modal.id = 'autofill-review-modal';
  modal.className = 'autofill-modal';
  modal.innerHTML = `
    <div class="autofill-modal-content">
      <div class="autofill-modal-header">
        <h2>Autofill Suggestions</h2>
        <button type="button" class="autofill-close" title="Close">&times;</button>
      </div>
      <div class="autofill-modal-body">
        <p>Review and accept/edit suggestions below. Fields left empty will not be filled.</p>
        <div id="autofill-suggestions-list"></div>
      </div>
      <div class="autofill-modal-footer">
        <button type="button" class="autofill-btn autofill-btn-secondary" id="autofill-cancel">Cancel</button>
        <button type="button" class="autofill-btn autofill-btn-primary" id="autofill-submit">Apply Suggestions</button>
      </div>
    </div>
  `;

  // Inject styles
  injectModalStyles();

  // Populate suggestions
  const listContainer = modal.querySelector('#autofill-suggestions-list');
  const suggestionMap = new Map();

  for (const suggestion of suggestions) {
    suggestionMap.set(suggestion.fieldId, suggestion);

    const item = document.createElement('div');
    item.className = 'autofill-suggestion-item';
    item.innerHTML = `
      <label class="autofill-field-label">${getAllFieldLabelForId(suggestion.fieldId, allFields)}</label>
      <div class="autofill-suggestion-container">
        <textarea 
          class="autofill-suggestion-input" 
          data-field-id="${suggestion.fieldId}"
          placeholder="No suggestion"
        >${suggestion.value || ''}</textarea>
        <div class="autofill-confidence">
          <small>Confidence: ${Math.round(suggestion.confidence * 100)}%</small>
        </div>
      </div>
    `;

    listContainer.appendChild(item);
  }

  // Attach event listeners
  modal.querySelector('.autofill-close').onclick = () => modal.remove();
  modal.querySelector('#autofill-cancel').onclick = () => modal.remove();
  modal.querySelector('#autofill-submit').onclick = () => {
    applyAndRecordSuggestions(suggestions, modal);
  };

  document.body.appendChild(modal);
}

/**
 * Apply suggestions to form fields and record user acceptance
 */
function applyAndRecordSuggestions(suggestions, modal) {
  const inputs = document.querySelectorAll('input, textarea, select');
  const modifiedSuggestions = [];

  for (const suggestion of suggestions) {
    const inputElement = document.getElementById(suggestion.fieldId) || 
                        document.querySelector(`[name="${suggestion.fieldId}"]`);

    if (!inputElement) continue;

    const suggestionInput = modal.querySelector(`[data-field-id="${suggestion.fieldId}"]`);
    const userValue = suggestionInput?.value || suggestion.value;

    if (userValue && userValue.trim()) {
      inputElement.value = userValue;
      inputElement.style.backgroundColor = '#e8f0fe';
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));

      modifiedSuggestions.push({
        fieldId: suggestion.fieldId,
        originalSuggestion: suggestion.value,
        userEdit: userValue,
        feedback: userValue === suggestion.value ? 'accepted' : 'edited'
      });
    }
  }

  // Record feedback for learning
  for (const feedback of modifiedSuggestions) {
    chrome.runtime.sendMessage({
      type: 'RECORD_FEEDBACK',
      data: {
        fieldId: feedback.fieldId,
        originalSuggestion: feedback.originalSuggestion,
        userEdit: feedback.userEdit,
        feedback: feedback.feedback
      }
    });
  }

  modal.remove();
  showNotification(`Applied ${modifiedSuggestions.length} suggestions`);
}

/**
 * Get field label from field list
 */
function getAllFieldLabelForId(fieldId, fields) {
  const field = fields.find(f => f.id === fieldId);
  return field ? field.label : fieldId;
}

/**
 * Show floating notification
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `autofill-notification autofill-notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'error' ? '#f44336' : '#4caf50'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: sans-serif;
    font-size: 14px;
  `;

  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

/**
 * Inject modal and notification styles
 */
function injectModalStyles() {
  if (document.getElementById('autofill-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'autofill-modal-styles';
  style.textContent = `
    .autofill-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .autofill-modal-content {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .autofill-modal-header {
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .autofill-modal-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .autofill-close {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 32px;
      height: 32px;
    }

    .autofill-modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .autofill-modal-footer {
      padding: 16px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .autofill-suggestion-item {
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #f0f0f0;
    }

    .autofill-field-label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
      font-size: 14px;
    }

    .autofill-suggestion-input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
      min-height: 50px;
      resize: vertical;
    }

    .autofill-suggestion-input:focus {
      outline: none;
      border-color: #2196f3;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .autofill-confidence {
      margin-top: 4px;
      color: #999;
      font-size: 12px;
    }

    .autofill-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .autofill-btn-primary {
      background: #2196f3;
      color: white;
    }

    .autofill-btn-primary:hover {
      background: #1976d2;
    }

    .autofill-btn-secondary {
      background: #f5f5f5;
      color: #333;
    }

    .autofill-btn-secondary:hover {
      background: #e0e0e0;
    }
  `;

  document.head.appendChild(style);
}

/**
 * Create floating autofill button
 */
function createAutofillButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('data-autofill-button', '');
  btn.innerHTML = '✨ Autofill';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    padding: 12px 16px;
    border: none;
    border-radius: 4px;
    background: #2196f3;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  btn.onmouseover = () => {
    btn.style.background = '#1976d2';
    btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
  };

  btn.onmouseout = () => {
    btn.style.background = '#2196f3';
    btn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
  };

  btn.onclick = requestAutofill;
  document.body.appendChild(btn);
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createAutofillButton);
} else {
  createAutofillButton();
}