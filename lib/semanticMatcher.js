/**
 * SemanticMatcher - Match form fields to knowledge graph entities
 * Uses context-aware semantic analysis instead of pattern matching
 */

import { GraphStorage } from './graphStorage.js';
import { GraphQuery } from './graphQuery.js';
import { SemanticContextAnalyzer } from './semanticContextAnalyzer.js';

export class SemanticMatcher {
  /**
   * Analyze a form field using context-aware semantic analysis
   * @param {HTMLElement} fieldElement - The actual DOM field element
   * @returns {Object} Field analysis with intent and entity types
   */
  static async analyzeFieldElement(fieldElement) {
    // Use context-aware analyzer instead of text patterns
    const context = SemanticContextAnalyzer.analyzeFieldContext(fieldElement);

    return {
      fieldId: context.directContext.id || context.directContext.name,
      fieldElement: fieldElement,
      intent: context.intent,
      entityTypes: context.expectedEntityTypes,
      constraints: context.constraints,
      contextStrength: context.semanticSignals.contextStrength,
      fullContext: context
    };
  }

  /**
   * Analyze a form field from field object (backward compatibility)
   * @param {Object} field - Field object with id, label, type, context
   * @returns {Object} Field analysis
   */
  static analyzeField(field) {
    // Fallback for non-DOM field objects
    const text = `${field.label || ''} ${field.context?.placeholder || ''} ${field.context?.helperText || ''}`.toLowerCase();

    return {
      fieldId: field.id,
      intent: this._classifyIntentFromText(text),
      entityTypes: this._predictEntityTypesFromText(text),
      keywords: this._extractFieldKeywords(text),
      type: field.type
    };
  }

  /**
   * Classify intent from text (fallback for non-DOM objects)
   * @private
   */
  static _classifyIntentFromText(text) {
    const signals = {};
    
    signals.personal_name = this._scoreSignals(text, ['name', 'first name', 'last name', 'full name', 'your name']);
    signals.personal_email = this._scoreSignals(text, ['email', 'e-mail', 'email address', 'contact email']);
    signals.personal_phone = this._scoreSignals(text, ['phone', 'telephone', 'mobile', 'cell phone', 'contact number']);
    signals.personal_address = this._scoreSignals(text, ['address', 'street', 'city', 'state', 'zip', 'postal', 'location']);
    signals.professional_title = this._scoreSignals(text, ['job title', 'title', 'position', 'role']);
    signals.professional_experience = this._scoreSignals(text, ['experience', 'years of experience', 'experience level', 'expertise']);
    signals.professional_summary = this._scoreSignals(text, ['summary', 'bio', 'about', 'background', 'profile']);
    signals.professional_narrative = this._scoreSignals(text, ['describe', 'tell us', 'explain', 'example', 'achievement', 'leadership', 'challenge', 'project', 'accomplishment']);
    signals.education = this._scoreSignals(text, ['education', 'degree', 'university', 'college', 'school', 'institution', 'major', 'certification']);
    signals.skills = this._scoreSignals(text, ['skill', 'skills', 'technical skills', 'expertise', 'competency', 'ability', 'proficiency']);

    const sorted = Object.entries(signals).sort(([, a], [, b]) => b - a);
    return sorted[0][1] > 0 ? sorted[0][0] : 'other';
  }

  /**
   * Predict entity types from text (fallback)
   * @private
   */
  static _predictEntityTypesFromText(text) {
    const predictions = [];

    if (/skill|technical|expertise|proficiency|ability|competenc/.test(text)) {
      predictions.push('skill');
      predictions.push('tech_skill');
    }

    if (/role|title|position|job|experience/.test(text)) {
      predictions.push('role');
    }

    if (/company|organization|employer|firm|client/.test(text)) {
      predictions.push('org');
    }

    if (/project|work|assignment|initiative|implementation/.test(text)) {
      predictions.push('project');
    }

    if (/award|recognition|achievement|accomplishment|honor/.test(text)) {
      predictions.push('achievement');
    }

    if (/education|degree|university|college|school|certificate/.test(text)) {
      predictions.push('education');
    }

    if (/leadership|led|manage|team|collaborative/.test(text)) {
      predictions.push('role', 'skill');
    }

    return predictions.length > 0 ? predictions : ['skill', 'role'];
  }

  /**
   * Extract keywords from field text
   * @private
   */
  static _extractFieldKeywords(text) {
    const words = text.split(/\s+/).filter(w => w.length > 3);
    const stopwords = new Set(['your', 'the', 'and', 'that', 'this', 'tell', 'about', 'with', 'from', 'have']);
    
    return words
      .filter(w => !stopwords.has(w))
      .slice(0, 5);
  }

  /**
   * Find matching entities for a field using context-aware analysis
   * @param {Object} fieldAnalysis - Result from analyzeFieldElement
   * @param {number} maxSuggestions - Max results to return
   * @returns {Promise<Array>} Matching entities with confidence
   */
  static async findMatches(fieldAnalysis, maxSuggestions = 3) {
    const matches = [];
    const { entityTypes, fullContext } = fieldAnalysis;

    // Strategy 1: Search by predicted entity types (using context strength)
    const contextWeight = fullContext?.semanticSignals?.contextStrength || 0.7;
    
    for (const entityType of entityTypes) {
      const nodes = await GraphStorage.getNodesByType(entityType);
      matches.push(
        ...nodes.map(node => ({
          node,
          strategy: 'type_match',
          contextWeight,
          confidence: 0.7 * contextWeight
        }))
      );
    }

    // Strategy 2: Semantic search based on intent
    if (fullContext) {
      const intentKeywords = this._extractIntentKeywords(fullContext.intent);
      for (const keyword of intentKeywords) {
        const results = await GraphQuery.search(keyword, 0.5);
        matches.push(
          ...results.map(node => ({
            node,
            strategy: 'intent_semantic',
            confidence: 0.8 * contextWeight
          }))
        );
      }
    }

    // Strategy 3: Context-based relationship discovery
    if (fieldAnalysis.fieldElement) {
      const siblingMatches = await this._findSiblingContextMatches(fieldAnalysis.fieldElement);
      matches.push(...siblingMatches);
    }

    // Deduplicate and sort by confidence
    const deduped = new Map();
    for (const match of matches) {
      const id = match.node.id;
      if (!deduped.has(id)) {
        deduped.set(id, match);
      } else {
        if (match.confidence > deduped.get(id).confidence) {
          deduped.set(id, match);
        }
      }
    }

    return Array.from(deduped.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions)
      .map(m => m.node);
  }

  /**
   * Find matches based on sibling field context
   * @private
   */
  static async _findSiblingContextMatches(fieldElement) {
    const matches = [];
    const form = fieldElement.closest('form');
    if (!form) return matches;

    // Get all sibling fields and their context
    const siblingFields = form.querySelectorAll('input, textarea, select');
    
    for (const sibling of Array.from(siblingFields).slice(0, 3)) {
      const siblingContext = SemanticContextAnalyzer.analyzeFieldContext(sibling);
      
      // If sibling has clear intent, look for related entities
      if (siblingContext.intent !== 'other') {
        const siblingKeywords = this._extractIntentKeywords(siblingContext.intent);
        for (const keyword of siblingKeywords) {
          const results = await GraphQuery.search(keyword, 0.5);
          matches.push(
            ...results.map(node => ({
              node,
              strategy: 'sibling_context',
              confidence: 0.6  // Lower confidence for indirect matches
            }))
          );
        }
      }
    }

    return matches;
  }

  /**
   * Extract keywords for an intent
   * @private
   */
  static _extractIntentKeywords(intent) {
    const intentKeywordMap = {
      professional_narrative: ['project', 'leadership', 'achievement', 'challenge', 'solution'],
      professional_experience: ['role', 'company', 'skill', 'achievement'],
      professional_summary: ['role', 'expert', 'skill', 'achievement'],
      education: ['degree', 'university', 'institution', 'major'],
      skills: ['skill', 'technology', 'expertise'],
      professional_title: ['role', 'title', 'position']
    };

    return intentKeywordMap[intent] || [];
  }

  /**
   * Match a single form field to knowledge graph and generate suggestion
   * @param {HTMLElement|Object} field - Form field (DOM or object)
   * @returns {Promise<Object>} Suggestion with matched entity and confidence
   */
  static async suggestForField(field) {
    let analysis;

    // Handle both DOM elements and field objects
    if (field instanceof HTMLElement) {
      analysis = await this.analyzeFieldElement(field);
    } else {
      analysis = this.analyzeField(field);
    }

    const matches = await this.findMatches(analysis);

    if (matches.length === 0) {
      return {
        fieldId: field.id,
        suggestion: null,
        confidence: 0,
        analysis
      };
    }

    const primaryMatch = matches[0];

    // For simple fields, return the entity label
    const fieldType = field.type || (field instanceof HTMLElement ? field.type : 'text');
    if (fieldType !== 'textarea') {
      return {
        fieldId: field.id,
        suggestion: primaryMatch.label,
        confidence: 0.85,
        sourceNode: primaryMatch,
        analysis
      };
    }

    // For narrative fields, narrative generator will create text from graph
    return {
      fieldId: field.id,
      suggestion: null,
      sourceNode: primaryMatch,
      confidence: 0.75,
      analysis
    };
  }

  /**
   * Batch match multiple form fields
   * @param {Array<HTMLElement|Object>} fields - Array of field elements or objects
   * @returns {Promise<Array>} Suggestions for each field
   */
  static async suggestForFields(fields) {
    return Promise.all(fields.map(field => this.suggestForField(field)));
  }

  /**
   * Helper: Score signal matches
   * @private
   */
  static _scoreSignals(text, keywords) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.split(' ').length;
      }
    }
    return score;
  }
}
