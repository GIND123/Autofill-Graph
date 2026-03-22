/**
 * Sample Data Initialization Script
 * Loads sample data from the prototype to populate the knowledge graph
 * This can be run manually or during first-time setup
 */

class SampleDataLoader {
  /**
   * Generate sample profile data (from prototype)
   */
  static getSampleProfileData() {
    return {
      "Full Name": "Govind",
      "Personal Email": "gov.grad@umd.edu",
      "Phone Number": "+1-301-555-0199",
      "Current Address": "College Park, MD 20740",
      "Portfolio URL": "github.com/gov-ai"
    };
  }

  /**
   * Generate sample academic data
   */
  static getSampleAcademicData() {
    return {
      "University Name": "University of Maryland",
      "Department": "Computer Science",
      "Degree Program": "Master of Science in Machine Learning",
      "Faculty Advisor": "Dr. Smith",
      "GPA": "3.9",
      "Research Interests": "Knowledge Graphs, LLMs, Automation"
    };
  }

  /**
   * Generate sample project data
   */
  static getSampleProjectData() {
    return {
      "Project Name": "Privacy-First Autofill System",
      "Description": "Built a Chrome extension for intelligent form filling using knowledge graphs",
      "Technologies": "JavaScript, Mistral AI, Knowledge Graphs",
      "Duration": "3 months",
      "Role": "Lead Developer"
    };
  }

  /**
   * Generate sample experience data
   */
  static getSampleExperienceData() {
    return {
      "Company": "AI Research Lab",
      "Position": "Research Engineer",
      "Duration": "1 year",
      "Achievements": "Developed semantic matching systems, improved accuracy by 40%",
      "Skills": "NLP, Machine Learning, System Design"
    };
  }

  /**
   * Generate all sample data
   */
  static getAllSampleData() {
    return [
      {
        data: this.getSampleProfileData(),
        context: "User Profile"
      },
      {
        data: this.getSampleAcademicData(),
        context: "Academic Record"
      },
      {
        data: this.getSampleProjectData(),
        context: "Project Experience"
      },
      {
        data: this.getSampleExperienceData(),
        context: "Work Experience"
      }
    ];
  }

  /**
   * Generate sample form fields for testing autofill
   */
  static getSampleFormFields() {
    return [
      "Candidate Name",
      "Contact Email",
      "Current Residency",
      "Degree Pursuing",
      "Tech Interests",
      "Professional Summary (Write 50 words)",
      "Previous Employer",
      "Key Accomplishments"
    ];
  }

  /**
   * Load sample data into extension storage
   * This initializes the graph with sample data
   */
  static async initializeWithSampleData(apiKey) {
    try {
      console.log("Initializing with sample data...");

      // Store API key
      if (apiKey) {
        await chrome.storage.local.set({ apiKey });
        console.log("API key stored");
      }

      // Create initial graph structure with sample triples
      const sampleGraph = {
        nodes: {
          "User": { type: "person" },
          "Govind": { type: "name" },
          "gov.grad@umd.edu": { type: "email" },
          "College Park, MD 20740": { type: "address" },
          "University of Maryland": { type: "organization" },
          "Computer Science": { type: "field" },
          "Master of Science in Machine Learning": { type: "degree" },
          "Knowledge Graphs": { type: "skill" },
          "Machine Learning": { type: "skill" },
          "LLMs": { type: "skill" },
          "Automation": { type: "skill" },
          "Privacy-First Autofill System": { type: "project" },
          "AI Research Lab": { type: "organization" },
          "Research Engineer": { type: "role" }
        },
        edges: [
          { head: "User", tail: "Govind", relation: "HAS_NAME" },
          { head: "User", tail: "gov.grad@umd.edu", relation: "HAS_EMAIL" },
          { head: "User", tail: "College Park, MD 20740", relation: "LIVES_IN" },
          { head: "User", tail: "University of Maryland", relation: "STUDIES_AT" },
          { head: "University of Maryland", tail: "Computer Science", relation: "HAS_DEPARTMENT" },
          { head: "User", tail: "Master of Science in Machine Learning", relation: "PURSUING_DEGREE" },
          { head: "User", tail: "Knowledge Graphs", relation: "INTERESTED_IN" },
          { head: "User", tail: "LLMs", relation: "INTERESTED_IN" },
          { head: "User", tail: "Machine Learning", relation: "EXPERT_IN" },
          { head: "Privacy-First Autofill System", tail: "Knowledge Graphs", relation: "USES_TECHNOLOGY" },
          { head: "User", tail: "Privacy-First Autofill System", relation: "BUILT_PROJECT" },
          { head: "User", tail: "AI Research Lab", relation: "WORKED_AT" },
          { head: "User", tail: "Research Engineer", relation: "HAS_ROLE" }
        ],
        timestamp: Date.now()
      };

      await chrome.storage.local.set({ graph: sampleGraph });
      console.log("Sample data loaded successfully");

      return {
        success: true,
        nodeCount: Object.keys(sampleGraph.nodes).length,
        edgeCount: sampleGraph.edges.length
      };
    } catch (error) {
      console.error("Error initializing sample data:", error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * If running in Node.js environment (for initialization scripts)
 * This allows the script to be called from npm init-sample-data
 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = SampleDataLoader;
}

/**
 * Simple initialization that can be called from extensions
 */
async function initializeSampleData() {
  const result = await chrome.storage.local.get("apiKey");
  const apiKey = result.apiKey || process.env.API_KEY;

  if (!apiKey) {
    console.warn("No API key found. Using sample data without API.");
  }

  return await SampleDataLoader.initializeWithSampleData(apiKey);
}

// Export for use in initialization
if (typeof window !== "undefined") {
  window.SampleDataLoader = SampleDataLoader;
  window.initializeSampleData = initializeSampleData;
}
