/**
 * Popup Script
 * Handles UI interactions and messaging with background script
 */

class PopupUI {
  constructor() {
    this.messageTimeout = null;
    this.init();
  }

  /**
   * Initialize popup UI
   */
  async init() {
    this.setupEventListeners();
    await this.checkApiKeyStatus();
    await this.updateGraphStats();
    this.setupTabNavigation();
  }

  /**
   * Setup event listeners for all buttons
   */
  setupEventListeners() {
    // Quick Actions
    document.getElementById("detectFormsBtn").addEventListener("click", () =>
      this.detectForms()
    );
    document.getElementById("autofillBtn").addEventListener("click", () =>
      this.autofillForm()
    );
    document.getElementById("learnBtn").addEventListener("click", () =>
      this.learnFromForm()
    );

    // Settings
    document.getElementById("saveApiKeyBtn").addEventListener("click", () =>
      this.saveApiKey()
    );
    document.getElementById("loadSampleDataBtn").addEventListener("click", () =>
      this.loadSampleData()
    );
    document.getElementById("clearGraphBtn").addEventListener("click", () =>
      this.clearGraph()
    );
    document.getElementById("exportGraphBtn").addEventListener("click", () =>
      this.exportGraph()
    );

    // Load saved API key if exists
    this.loadSavedApiKey();
  }

  /**
   * Setup tab navigation
   */
  setupTabNavigation() {
    const tabs = document.querySelectorAll(".tab");
    const contents = document.querySelectorAll(".tab-content");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab;

        // Deactivate all tabs and contents
        tabs.forEach((t) => t.classList.remove("active"));
        contents.forEach((c) => c.classList.remove("active"));

        // Activate selected tab
        tab.classList.add("active");
        document.getElementById(tabName).classList.add("active");

        // Update content based on tab
        if (tabName === "graph") {
          this.updateGraphPreview();
        } else if (tabName === "insights") {
          this.updateInsightsTab();
        }
      });
    });
  }

  /**
   * Check if API key is configured
   */
  async checkApiKeyStatus() {
    chrome.runtime.sendMessage({ type: "GET_API_KEY_STATUS" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        return;
      }

      const statusEl = document.getElementById("statusText");
      if (response && response.hasApiKey) {
        statusEl.textContent = "Connected";
        statusEl.className = "status connected";
      } else {
        statusEl.textContent = "API key not configured";
        statusEl.className = "status disconnected";
        this.showMessage(
          "API key not configured. Please add it in Settings tab.",
          "error"
        );
      }
    });
  }

  /**
   * Load and display saved API key (masked)
   */
  async loadSavedApiKey() {
    const result = await chrome.storage.local.get("apiKey");
    const apiKeyInput = document.getElementById("apiKeyInput");
    if (result.apiKey) {
      apiKeyInput.value = "••••••••••••••••";
      apiKeyInput.dataset.masked = true;
    }
  }

  /**
   * Save API key
   */
  async saveApiKey() {
    const apiKeyInput = document.getElementById("apiKeyInput");
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey || apiKey.startsWith("•")) {
      this.showMessage("Please enter a valid API key", "error");
      return;
    }

    chrome.runtime.sendMessage(
      { type: "SET_API_KEY", apiKey },
      (response) => {
        if (response.success) {
          this.showMessage("API key saved successfully", "success");
          apiKeyInput.value = "••••••••••••••••";
          apiKeyInput.dataset.masked = true;
          this.checkApiKeyStatus();
          setTimeout(() => this.updateGraphStats(), 500);
        } else {
          this.showMessage("Failed to save API key", "error");
        }
      }
    );
  }

  /**
   * Detect forms on the current page
   */
  async detectForms() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        this.showMessage("No active tab found", "error");
        return;
      }

      chrome.tabs.sendMessage(
        tab.id,
        { type: "DETECT_FORMS" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            this.showMessage(
              "Content script not loaded. Try refreshing the page.",
              "error"
            );
            return;
          }

          if (!response || response.error) {
            this.showMessage("Error detecting forms: " + (response?.error || "Unknown error"), "error");
            return;
          }

          const { stats } = response;
          const message =
            stats.forms > 0
              ? `Found ${stats.forms} forms with ${stats.inputs} input fields`
              : "No forms found on this page";

          this.showMessage(message, stats.forms > 0 ? "success" : "info");
        }
      );
    } catch (error) {
      console.error("Error in detectForms:", error);
      this.showMessage("Error: " + error.message, "error");
    }
  }

  /**
   * Autofill the current form
   */
  async autofillForm() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        this.showMessage("No active tab found", "error");
        return;
      }

      this.showMessage("Autofilling form...", "info");

      chrome.tabs.sendMessage(
        tab.id,
        { type: "AUTOFILL_CURRENT_FORM" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            this.showMessage(
              "Content script not loaded. Try refreshing the page.",
              "error"
            );
            return;
          }

          if (!response || response.error) {
            this.showMessage("Error autofilling: " + (response?.error || "Unknown error"), "error");
            return;
          }

          if (response.success) {
            this.showMessage("Form autofilled successfully!", "success");
            setTimeout(() => this.updateGraphStats(), 500);
          } else {
            this.showMessage("Autofill completed with some errors", "warning");
          }
        }
      );
    } catch (error) {
      console.error("Error in autofillForm:", error);
      this.showMessage("Error: " + error.message, "error");
    }
  }

  /**
   * Learn from current form and update graph
   */
  async learnFromForm() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        this.showMessage("No active tab found", "error");
        return;
      }

      this.showMessage("Learning from this form...", "info");

      chrome.tabs.sendMessage(
        tab.id,
        { type: "LEARN_FROM_CURRENT_FORM" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            this.showMessage(
              "Content script not loaded. Try refreshing the page.",
              "error"
            );
            return;
          }

          if (!response || response.error) {
            this.showMessage("Error learning from form: " + (response?.error || "Unknown error"), "error");
            return;
          }

          if (response.success) {
            this.showMessage("Successfully learned from form!", "success");
            setTimeout(() => this.updateGraphStats(), 1000);
          } else {
            this.showMessage("Learning completed with some errors", "warning");
          }
        }
      );
    } catch (error) {
      console.error("Error in learnFromForm:", error);
      this.showMessage("Error: " + error.message, "error");
    }
  }

  /**
   * Update and display graph statistics (Enhanced for Prototype2)
   */
  async updateGraphStats() {
    chrome.runtime.sendMessage(
      { type: "GET_GRAPH_STATS" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError);
          return;
        }

        const statsEl = document.getElementById("graphStats");

        if (!response || !response.stats) {
          statsEl.innerHTML =
            '<div class="stat-row"><span class="stat-label">Status</span><span class="stat-value">No data</span></div>';
          return;
        }

        const stats = response.stats;

        let html = `
          <div class="stat-row">
            <span class="stat-label">Entities</span>
            <span class="stat-value">${stats.entities || stats.nodeCount || 0}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Relationships</span>
            <span class="stat-value">${stats.relations || stats.edgeCount || 0}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Facts (Current)</span>
            <span class="stat-value">${stats.facts_current || 0}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Facts (Inferred)</span>
            <span class="stat-value">${stats.facts_inferred || 0}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Local Fills</span>
            <span class="stat-value">${stats.local_fills || 0}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">API Fills</span>
            <span class="stat-value">${stats.api_fills || 0}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">API Calls</span>
            <span class="stat-value">${stats.api_calls || 0}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Ready to Autofill</span>
            <span class="stat-value">${(stats.facts_current || 0) > 5 ? "✓ Yes" : "Limited"}</span>
          </div>
        `;

        // Add temporal info if expired facts exist
        if (stats.facts_expired && stats.facts_expired > 0) {
          html += `
            <div class="stat-row" style="color: #999;">
              <span class="stat-label">Facts (Expired)</span>
              <span class="stat-value">${stats.facts_expired}</span>
            </div>
          `;
        }

        statsEl.innerHTML = html;
      }
    );
  }

  /**
   * Update graph preview
   */
  async updateGraphPreview() {
    chrome.runtime.sendMessage(
      { type: "GET_GRAPH_STATS" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError);
          return;
        }

        const previewEl = document.getElementById("graphPreview");

        if (!response || !response.stats || response.stats.nodeCount === 0) {
          previewEl.innerHTML =
            '<div style="text-align: center; color: #999; padding: 20px;">Graph is empty. Fill a form and click "Learn This Form" to add data.</div>';
          return;
        }

        const { nodes, edges } = response.stats;

        let html = "<div>";

        // Display nodes
        if (nodes && nodes.length > 0) {
          html += '<div style="margin-bottom: 10px; font-weight: 600; color: #667eea;">Entities:</div>';
          nodes.forEach((node) => {
            html += `<div class="node-item">• ${node}</div>`;
          });
        }

        // Display edges
        if (edges && edges.length > 0) {
          html += '<div style="margin: 10px 0; font-weight: 600; color: #667eea;">Relationships:</div>';
          edges.slice(0, 10).forEach((edge) => {
            html += `<div class="edge-item">→ (${edge.head}) -[${edge.relation}]-> (${edge.tail})</div>`;
          });

          if (edges.length > 10) {
            html += `<div class="edge-item" style="margin-top: 10px; color: #999;">... and ${edges.length - 10} more</div>`;
          }
        }

        html += "</div>";
        previewEl.innerHTML = html;
      }
    );
  }

  /**
   * Load sample data into the graph
   */
  async loadSampleData() {
    try {
      this.showMessage("Loading sample data...", "info");

      chrome.runtime.sendMessage(
        { type: "LOAD_SAMPLE_DATA" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            this.showMessage(
              "Error loading sample data: " + chrome.runtime.lastError.message,
              "error"
            );
            return;
          }

          if (!response || response.error) {
            this.showMessage(
              "Error loading sample data: " + (response?.error || "Unknown error"),
              "error"
            );
            return;
          }

          if (response.success) {
            this.showMessage("Sample data loaded successfully!", "success");
            setTimeout(() => this.updateGraphStats(), 1000);
          }
        }
      );
    } catch (error) {
      console.error("Error in loadSampleData:", error);
      this.showMessage("Error: " + error.message, "error");
    }
  }

  /**
   * Clear the knowledge graph
   */
  async clearGraph() {
    if (
      !confirm(
        "Are you sure you want to clear the entire knowledge graph? This action cannot be undone."
      )
    ) {
      return;
    }

    await chrome.storage.local.set({ graph: null });
    this.showMessage("Graph cleared", "success");
    this.updateGraphStats();
  }

  /**
   * Export graph as JSON
   */
  async exportGraph() {
    const graphData = await chrome.storage.local.get("graph");

    if (!graphData.graph) {
      this.showMessage("No graph data to export", "error");
      return;
    }

    const json = JSON.stringify(graphData.graph, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autofill-graph-${Date.now()}.json`;
    a.click();

    this.showMessage("Graph exported", "success");
  }

  /**
   * Show a message to the user
   */
  showMessage(text, type = "info") {
    const container = document.getElementById("messageContainer");

    const messageEl = document.createElement("div");
    messageEl.className = `message ${type}`;
    messageEl.textContent = text;

    container.innerHTML = "";
    container.appendChild(messageEl);

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = setTimeout(() => {
      messageEl.remove();
    }, 5000);
  }

  /**
   * Update the Insights tab with inferences, temporal history, and privacy stats (Prototype2)
   */
  async updateInsightsTab() {
    chrome.runtime.sendMessage(
      { type: "GET_INSIGHTS" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError);
          return;
        }

        if (!response || !response.insights) {
          this.displayDefaultInsights();
          return;
        }

        const insights = response.insights;

        // Display inferred facts
        this.displayInferredFacts(insights.inferences || []);

        // Display temporal history
        this.displayTemporalHistory(insights.history || {});

        // Display privacy stats
        this.displayPrivacyStats(insights.privacy || {});
      }
    );
  }

  displayInferredFacts(inferences) {
    const container = document.getElementById("inferredFacts");

    if (!inferences || inferences.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No inferences yet</div>';
      return;
    }

    let html = '<div>';
    inferences.slice(0, 10).forEach((inf, idx) => {
      html += `
        <div class="edge-item" style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border-left: 3px solid #667eea;">
          <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${inf.field} = ${inf.value}</div>
          <div style="font-size: 10px; color: #999;">Rule: ${inf.rule} | Confidence: ${(inf.confidence * 100).toFixed(0)}%</div>
          <div style="font-size: 9px; color: #aaa;">Sources: ${inf.source_facts?.join(', ') || 'N/A'}</div>
        </div>
      `;
    });

    if (inferences.length > 10) {
      html += `<div style="text-align: center; color: #999; padding: 10px;">... and ${inferences.length - 10} more</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  displayTemporalHistory(history) {
    const container = document.getElementById("temporalHistory");

    if (!history || Object.keys(history).length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No history available</div>';
      return;
    }

    let html = '<div>';

    for (const [property, values] of Object.entries(history)) {
      if (values.length > 1) {
        html += `
          <div style="margin-bottom: 12px; padding: 8px; background: white; border-radius: 4px;">
            <div style="font-weight: 600; color: #667eea; margin-bottom: 6px;">${property}</div>
        `;

        values.forEach((val, idx) => {
          const isCurrent = !val.valid_until || new Date(val.valid_until) > new Date();
          html += `
            <div style="font-size: 10px; color: #666; padding: 4px 0; border-left: 2px solid ${isCurrent ? '#28a745' : '#999'}; padding-left: 8px; margin-left: 4px;">
              <div style="font-weight: 500;">${val.value} ${isCurrent ? '(current)' : '(expired)'}</div>
              <div style="font-size: 9px; color: #999;">
                From: ${new Date(val.valid_from).toLocaleDateString()}
                ${val.valid_until ? ' | Until: ' + new Date(val.valid_until).toLocaleDateString() : ''}
              </div>
            </div>
          `;
        });

        html += '</div>';
      }
    }

    if (html === '<div>') {
      container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No temporal changes detected</div>';
    } else {
      html += '</div>';
      container.innerHTML = html;
    }
  }

  displayPrivacyStats(privacy) {
    const container = document.getElementById("privacyStats");

    const publicCount = privacy.public || 0;
    const restrictedCount = privacy.restricted || 0;
    const encryptedCount = privacy.encrypted || 0;
    const total = publicCount + restrictedCount + encryptedCount;

    let html = `
      <div class="stat-row">
        <span class="stat-label">Public Facts</span>
        <span class="stat-value" style="color: #28a745;">${publicCount}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Restricted Facts</span>
        <span class="stat-value" style="color: #ffc107;">${restrictedCount}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Encrypted Facts</span>
        <span class="stat-value" style="color: #dc3545;">${encryptedCount}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Total</span>
        <span class="stat-value">${total}</span>
      </div>
    `;

    container.innerHTML = html;
  }

  displayDefaultInsights() {
    document.getElementById("inferredFacts").innerHTML =
      '<div style="text-align: center; color: #999; padding: 20px;">No inferences yet</div>';
    document.getElementById("temporalHistory").innerHTML =
      '<div style="text-align: center; color: #999; padding: 20px;">No history available</div>';
    document.getElementById("privacyStats").innerHTML =
      '<div style="text-align: center; color: #999; padding: 20px;">No data</div>';
  }
}

// Initialize popup UI when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new PopupUI();
  });
} else {
  new PopupUI();
}
