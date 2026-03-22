/**
 * Content Script
 * Detects form fields and handles user interactions for autofill
 */

class FormDetector {
  constructor() {
    this.forms = [];
    this.fieldsWithSuggestions = new Map();
    this.initObservers();
  }

  /**
   * Detect all forms on the page
   */
  detectForms() {
    const allForms = document.querySelectorAll("form");
    const allInputs = document.querySelectorAll(
      "input[type='text'], textarea, select"
    );

    this.forms = Array.from(allForms);
    this.detectedInputs = Array.from(allInputs);

    console.log(`Detected ${this.forms.length} forms, ${this.detectedInputs.length} inputs`);
    return {
      forms: this.forms.length,
      inputs: this.detectedInputs.length
    };
  }

  /**
   * Extract field information for autofill
   */
  extractFormFieldInfo() {
    const fields = [];

    for (const input of this.detectedInputs) {
      const label = this.getFieldLabel(input);
      const placeholder = input.placeholder || "";
      const name = input.name || "";

      if (label || placeholder || name) {
        fields.push({
          element: input,
          label,
          placeholder,
          name,
          type: input.type,
          value: input.value
        });
      }
    }

    return fields;
  }

  /**
   * Get label text for an input field
   */
  getFieldLabel(input) {
    // Check associated label
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Check parent label
    let parent = input.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const label = parent.querySelector("label");
      if (label) return label.textContent.trim();
      parent = parent.parentElement;
    }

    return "";
  }

  /**
   * Inject autofill suggestions into the page
   */
  injectSuggestions(suggestions) {
    for (const [fieldInfo, suggestion] of Object.entries(suggestions)) {
      const input = document.querySelector(`input[name="${fieldInfo}"]`);
      if (input && suggestion !== "NULL") {
        // Add a data attribute with the suggestion
        input.dataset.autofillSuggestion = suggestion;
        input.style.backgroundColor = "#fffacd"; // Light yellow hint
        input.title = `Suggested: ${suggestion}`;
      }
    }
  }

  /**
   * Set up observers for dynamic content
   */
  initObservers() {
    const observer = new MutationObserver(() => {
      this.detectForms();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }
}

let formDetector = null;

/**
 * Initialize content script
 */
function init() {
  formDetector = new FormDetector();
  formDetector.detectForms();

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        switch (request.type) {
          case "DETECT_FORMS":
            const stats = formDetector.detectForms();
            sendResponse({ stats });
            break;

          case "GET_FORM_FIELDS":
            const fields = formDetector.extractFormFieldInfo();
            const fieldLabels = fields.map((f) => f.label || f.placeholder || f.name);
            sendResponse({ fields: fieldLabels });
            break;

          case "AUTOFILL_CURRENT_FORM":
            const formFields = formDetector.extractFormFieldInfo();

            if (formFields.length === 0) {
              sendResponse({ success: false, error: "No form fields detected" });
              break;
            }

            const fieldNames = formFields.map((f) => f.label || f.placeholder || f.name);

            // Send to background script for ML processing
            chrome.runtime.sendMessage(
              {
                type: "AUTOFILL_FORM",
                formFields: fieldNames
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error("Runtime error:", chrome.runtime.lastError);
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                  return;
                }

                if (!response || response.error) {
                  sendResponse({ success: false, error: response?.error || "Autofill failed" });
                  return;
                }

                if (response.success) {
                  // Fill in the form
                  let filledCount = 0;
                  for (const field of formFields) {
                    const fieldKey = field.label || field.placeholder || field.name;
                    const value = response.filled[fieldKey];
                    if (value && value !== "NULL") {
                      field.element.value = value;
                      field.element.style.backgroundColor = "#e8f5e9"; // Light green
                      field.element.dispatchEvent(new Event("change", { bubbles: true }));
                      filledCount++;
                    }
                  }
                  console.log(`Autofilled ${filledCount} fields`);
                  sendResponse({ success: true, filledCount });
                } else {
                  sendResponse({ success: false, error: "Unexpected response format" });
                }
              }
            );
            return true;

          case "LEARN_FROM_CURRENT_FORM":
            const currentFields = formDetector.extractFormFieldInfo();

            if (currentFields.length === 0) {
              sendResponse({ success: false, error: "No form fields detected" });
              break;
            }

            const formData = {};
            for (const field of currentFields) {
              if (field.value) {
                const key = field.label || field.name || field.placeholder;
                if (key) {
                  formData[key] = field.value;
                }
              }
            }

            if (Object.keys(formData).length === 0) {
              sendResponse({ success: false, error: "No field values found. Please fill the form first." });
              break;
            }

            console.log("Learning from form data:", formData);

            chrome.runtime.sendMessage(
              {
                type: "LEARN_FROM_FORM",
                formData,
                context: "Web Form"
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error("Runtime error:", chrome.runtime.lastError);
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                  return;
                }

                if (!response) {
                  sendResponse({ success: false, error: "No response from background script" });
                  return;
                }

                sendResponse({ success: response.success, error: response.error });
              }
            );
            return true;

          default:
            sendResponse({ error: "Unknown message type" });
        }
      } catch (error) {
        console.error("Error in content script:", error);
        sendResponse({ error: error.message });
      }
    })();

    return true;
  });

  console.log("Content script initialized");
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
