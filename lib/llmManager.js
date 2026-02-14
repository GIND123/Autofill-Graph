/**
 * LLMManager - Manage local LLM inference through Chrome AI API
 * Handles session creation, prompting, and response parsing
 */

export class LLMManager {
  static session = null;
  static isInitialized = false;

  /**
   * Initialize the LLM session
   * Uses Chrome's ai.languageModel.create() API
   */
  static async initialize() {
    if (this.isInitialized && this.session) {
      return this.session;
    }

    try {
      // Check if AI API is available
      if (!window.ai || !window.ai.languageModel) {
        throw new Error('Chrome AI Language Model API not available. Please ensure you are using a compatible Chrome version with the API enabled.');
      }

      // Create session with appropriate system prompt
      this.session = await ai.languageModel.create({
        systemPrompt: `You are a helpful assistant for form filling. Your role is to provide concise, professional, and accurate responses based on provided context. 
        - Keep responses brief and to the point (under 200 words unless explicitly asked for more)
        - Use professional language
        - Be specific and factual
        - If you don't have enough context, ask for clarification rather than making assumptions
        - Format responses as plain text unless otherwise specified`
      });

      this.isInitialized = true;
      return this.session;
    } catch (error) {
      console.error('LLM initialization failed:', error);
      throw error;
    }
  }

  /**
   * Generate text using the LLM
   * @param {string} prompt - The prompt to send to the LLM
   * @returns {Promise<string>} Generated text
   */
  static async generate(prompt) {
    try {
      if (!this.session) {
        await this.initialize();
      }

      const response = await this.session.prompt(prompt);
      return response.trim();
    } catch (error) {
      console.error('LLM generation failed:', error);
      throw error;
    }
  }

  /**
   * Enhance a narrative with LLM refinement
   * @param {string} narrative - Base narrative to enhance
   * @param {string} formPrompt - Original form field prompt
   * @returns {Promise<string>} Enhanced narrative
   */
  static async enhanceNarrative(narrative, formPrompt) {
    const prompt = `Please refine the following response to a form field. Make it more professional, clear, and concise while preserving all key information.

Original form prompt: "${formPrompt}"

Current response: "${narrative}"

Enhanced response:`;

    return this.generate(prompt);
  }

  /**
   * Extract structured data from text
   * @param {string} text - Text to analyze
   * @param {string} schema - Schema description (e.g., "Extract name, email, phone")
   * @returns {Promise<Object>} Extracted structured data
   */
  static async extractStructured(text, schema) {
    const prompt = `Extract the following information in JSON format: ${schema}

Text: "${text}"

Return ONLY valid JSON, no markdown or other text.`;

    try {
      const response = await this.generate(prompt);
      // Clean up response (remove markdown code blocks if present)
      const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Structured extraction failed:', error);
      return {};
    }
  }

  /**
   * Classify text into categories
   * @param {string} text - Text to classify
   * @param {Array<string>} categories - Available categories
   * @returns {Promise<string>} Best matching category
   */
  static async classify(text, categories) {
    const prompt = `Classify the following text into one of these categories: ${categories.join(', ')}

Text: "${text}"

Return ONLY the category name, nothing else.`;

    return this.generate(prompt);
  }

  /**
   * Check if LLM is available
   * @returns {boolean}
   */
  static isAvailable() {
    return typeof window !== 'undefined' && window.ai && window.ai.languageModel;
  }

  /**
   * Destroy the current session to free resources
   */
  static async destroy() {
    if (this.session) {
      try {
        if (this.session.destroy) {
          await this.session.destroy();
        }
      } catch (error) {
        console.error('Error destroying LLM session:', error);
      }
      this.session = null;
      this.isInitialized = false;
    }
  }

  /**
   * Get token estimate for a prompt
   * Some LLM implementations provide token counting
   * @param {string} prompt - Prompt to estimate
   * @returns {number} Estimated token count
   */
  static estimateTokens(prompt) {
    // Rough estimate: ~1 token per 4 characters
    return Math.ceil(prompt.length / 4);
  }
}
