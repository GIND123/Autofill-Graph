/**
 * SemanticContextAnalyzer - Context-aware form field analysis
 * Analyzes DOM structure and semantic context instead of regex patterns
 * Provides deep understanding of form field intent through contextual analysis
 */

export class SemanticContextAnalyzer {
  /**
   * Analyze a form field's complete semantic context
   * @param {HTMLElement} element - The form field element
   * @returns {Object} Comprehensive context analysis
   */
  static analyzeFieldContext(element) {
    if (!element) return null;

    const context = {
      fieldElement: element,
      directContext: this._extractDirectContext(element),
      parentContext: this._extractParentContext(element),
      siblingContext: this._extractSiblingContext(element),
      formContext: this._extractFormContext(element),
      semanticHints: this._extractSemanticHints(element),
      fieldCharacteristics: this._analyzeFieldCharacteristics(element)
    };

    return {
      ...context,
      intent: this._inferIntentFromContext(context),
      expectedEntityTypes: this._inferEntityTypesFromContext(context),
      constraints: this._extractConstraints(element),
      semanticSignals: this._calculateSemanticSignals(context)
    };
  }

  /**
   * Extract immediate context around the field
   * @private
   */
  static _extractDirectContext(element) {
    const context = {
      id: element.id,
      name: element.name,
      type: element.type,
      placeholder: element.placeholder,
      value: element.value,
      ariaLabel: element.getAttribute('aria-label'),
      ariaDescribedBy: element.getAttribute('aria-describedby'),
      title: element.title,
      pattern: element.getAttribute('pattern'),
      dataAttributes: {}
    };

    // Extract data-* attributes
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-')) {
        context.dataAttributes[attr.name] = attr.value;
      }
    }

    return context;
  }

  /**
   * Extract context from parent elements (labels, fieldsets, etc)
   * @private
   */
  static _extractParentContext(element) {
    const context = {
      label: null,
      legend: null,
      fieldsetName: null,
      parentClasses: [],
      parentText: null
    };

    // Find associated label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        context.label = this._extractTextContent(label);
      }
    }

    // Find parent fieldset legend
    const fieldset = element.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        context.legend = this._extractTextContent(legend);
      }
      context.fieldsetName = fieldset.name;
    }

    // Analyze parent container classes
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      if (parent.className) {
        context.parentClasses.push(parent.className);
      }
      parent = parent.parentElement;
    }

    // Extract nearby text from parent container
    const container = element.closest('div, form, fieldset, section');
    if (container) {
      context.parentText = this._extractTextContent(container, element);
    }

    return context;
  }

  /**
   * Extract context from sibling elements
   * @private
   */
  static _extractSiblingContext(element) {
    const context = {
      precedingText: '',
      followingText: '',
      nearbyLabels: [],
      siblingInputs: []
    };

    // Extract preceding text
    let node = element.previousSibling;
    let textContent = '';
    while (node && textContent.length < 200) {
      if (node.nodeType === Node.TEXT_NODE) {
        textContent += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        textContent += this._extractTextContent(node);
      }
      node = node.previousSibling;
    }
    context.precedingText = textContent.trim();

    // Extract following text
    node = element.nextSibling;
    textContent = '';
    while (node && textContent.length < 200) {
      if (node.nodeType === Node.TEXT_NODE) {
        textContent += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        textContent += this._extractTextContent(node);
      }
      node = node.nextSibling;
    }
    context.followingText = textContent.trim();

    // Find nearby labels, hints, help text
    const parent = element.closest('div, small, section');
    if (parent) {
      const hints = parent.querySelectorAll('small, span[class*="help"], span[class*="hint"], span[class*="description"]');
      context.nearbyLabels = Array.from(hints).map(h => this._extractTextContent(h));
    }

    // Find sibling input fields
    const form = element.closest('form');
    if (form) {
      const siblings = form.querySelectorAll('input, textarea, select');
      context.siblingInputs = Array.from(siblings)
        .filter(s => s !== element)
        .slice(0, 5)  // Get up to 5 neighbors
        .map(s => ({
          name: s.name,
          placeholder: s.placeholder,
          label: this._getFieldLabel(s)
        }));
    }

    return context;
  }

  /**
   * Extract form-level context
   * @private
   */
  static _extractFormContext(element) {
    const form = element.closest('form');
    if (!form) return { formAction: null, formMethod: null, formElements: [] };

    return {
      formAction: form.action,
      formMethod: form.method,
      formId: form.id,
      formName: form.name,
      formTitle: form.querySelector('h1, h2, h3')?.textContent,
      totalFields: form.querySelectorAll('input, textarea, select').length,
      formClasses: form.className
    };
  }

  /**
   * Extract semantic hints from HTML attributes and content
   * @private
   */
  static _extractSemanticHints(element) {
    const hints = {
      ariaRoles: [],
      validationAttrs: {},
      semanticHTML: null,
      cssHints: {},
      textHints: []
    };

    // Check aria roles
    if (element.getAttribute('role')) {
      hints.ariaRoles.push(element.getAttribute('role'));
    }

    // Extract validation attributes
    if (element.required) hints.validationAttrs.required = true;
    if (element.pattern) hints.validationAttrs.pattern = element.pattern;
    if (element.min) hints.validationAttrs.min = element.min;
    if (element.max) hints.validationAttrs.max = element.max;
    if (element.maxLength) hints.validationAttrs.maxLength = element.maxLength;

    // Check semantic HTML context
    const form = element.closest('form');
    if (form) {
      const semanticParent = form.closest('article, section, main');
      if (semanticParent) {
        hints.semanticHTML = semanticParent.tagName;
      }
    }

    // Extract CSS hints
    const styles = window.getComputedStyle(element);
    if (styles.display === 'none') hints.cssHints.hidden = true;

    return hints;
  }

  /**
   * Analyze field type characteristics
   * @private
   */
  static _analyzeFieldCharacteristics(element) {
    return {
      inputType: element.type || 'text',
      isTextarea: element.tagName === 'TEXTAREA',
      isSelect: element.tagName === 'SELECT',
      isRequired: element.required,
      isHidden: element.hidden || element.style.display === 'none',
      maxLength: element.maxLength,
      rows: element.rows,
      cols: element.cols,
      placeholder: element.placeholder,
      options: element.tagName === 'SELECT' ? 
        Array.from(element.options).map(o => o.value) : []
    };
  }

  /**
   * Infer field intent from comprehensive context
   * @private
   */
  static _inferIntentFromContext(context) {
    const signals = {};
    const allText = [
      context.directContext.placeholder,
      context.parentContext.label,
      context.parentContext.legend,
      context.parentContext.parentText,
      context.siblingContext.precedingText,
      context.siblingContext.followingText,
      ...context.siblingContext.nearbyLabels
    ].join(' ').toLowerCase();

    // Score different intents based on text signals
    signals.personal_name = this._scoreSignals(allText, ['name', 'first name', 'last name', 'full name', 'your name']);
    signals.personal_email = this._scoreSignals(allText, ['email', 'e-mail', 'contact email', 'email address']);
    signals.personal_phone = this._scoreSignals(allText, ['phone', 'mobile', 'telephone', 'cell', 'contact']);
    signals.personal_address = this._scoreSignals(allText, ['address', 'street', 'city', 'state', 'zip', 'postal', 'location']);
    signals.professional_title = this._scoreSignals(allText, ['job title', 'title', 'position', 'role', 'designation']);
    signals.professional_experience = this._scoreSignals(allText, ['experience', 'years of', 'expertise', 'proficiency', 'skills']);
    signals.professional_summary = this._scoreSignals(allText, ['summary', 'bio', 'about', 'background', 'profile', 'overview']);
    signals.professional_narrative = this._scoreSignals(allText, ['describe', 'explain', 'tell us', 'example', 'achievement', 'demonstrate', 'leadership', 'challenge', 'project']);
    signals.education = this._scoreSignals(allText, ['education', 'degree', 'university', 'college', 'school', 'major', 'certification']);
    signals.skills = this._scoreSignals(allText, ['skill', 'technical', 'expertise', 'proficiency', 'ability', 'competency']);

    // Bonus scoring based on field characteristics
    if (context.fieldCharacteristics.inputType === 'email') signals.personal_email += 2;
    if (context.fieldCharacteristics.inputType === 'tel') signals.personal_phone += 2;
    if (context.fieldCharacteristics.isTextarea) signals.professional_narrative += 1;
    if (context.fieldCharacteristics.maxLength && context.fieldCharacteristics.maxLength < 100) {
      signals.professional_title += 0.5;
    }

    // Return best matching intent
    const sorted = Object.entries(signals).sort(([, a], [, b]) => b - a);
    return sorted[0][1] > 0 ? sorted[0][0] : 'other';
  }

  /**
   * Infer entity types from context
   * @private
   */
  static _inferEntityTypesFromContext(context) {
    const types = new Set();
    const allText = [
      context.directContext.placeholder,
      context.parentContext.label,
      context.parentContext.legend,
      context.directContext.ariaLabel
    ].join(' ').toLowerCase();

    if (/skill|technical|expertise|proficiency|ability|competenc|language|framework|tool/.test(allText)) {
      types.add('skill');
      types.add('tech_skill');
    }

    if (/role|title|position|job|designation|profession/.test(allText)) {
      types.add('role');
    }

    if (/company|organization|employer|firm|client|corporation/.test(allText)) {
      types.add('org');
    }

    if (/project|work|assignment|initiative|implementation|development/.test(allText)) {
      types.add('project');
    }

    if (/award|recognition|achievement|accomplishment|honor|success/.test(allText)) {
      types.add('achievement');
    }

    if (/education|degree|university|college|school|certificate|course/.test(allText)) {
      types.add('education');
    }

    if (/leadership|led|manage|team|collaborative|communication|collaboration/.test(allText)) {
      types.add('role');
      types.add('skill');
    }

    return Array.from(types).length > 0 ? Array.from(types) : ['skill', 'role'];
  }

  /**
   * Extract constraints from field and context
   * @private
   */
  static _extractConstraints(element) {
    return {
      required: element.required,
      pattern: element.getAttribute('pattern'),
      minLength: element.minLength,
      maxLength: element.maxLength,
      min: element.getAttribute('min'),
      max: element.getAttribute('max'),
      step: element.getAttribute('step'),
      inputType: element.type,
      readonly: element.readOnly,
      disabled: element.disabled
    };
  }

  /**
   * Calculate semantic signals strength
   * @private
   */
  static _calculateSemanticSignals(context) {
    const signals = {
      fromLabel: context.parentContext.label ? 1.0 : 0,
      fromLegend: context.parentContext.legend ? 0.9 : 0,
      fromPlaceholder: context.directContext.placeholder ? 0.7 : 0,
      fromAriaLabel: context.directContext.ariaLabel ? 0.95 : 0,
      fromNearbyText: context.siblingContext.nearbyLabels.length > 0 ? 0.8 : 0,
      fromParentClasses: context.parentContext.parentClasses.length > 0 ? 0.6 : 0,
      fromFieldType: context.fieldCharacteristics.inputType !== 'text' ? 0.5 : 0,
      contextStrength: 0  // Calculated below
    };

    // Calculate overall context strength
    let strength = 0;
    let sources = 0;
    for (const [key, value] of Object.entries(signals)) {
      if (key !== 'contextStrength' && typeof value === 'number') {
        strength += value;
        if (value > 0) sources++;
      }
    }
    signals.contextStrength = sources > 0 ? strength / sources : 0.3;

    return signals;
  }

  /**
   * Helper: Extract clean text content from element
   * @private
   */
  static _extractTextContent(element, exclude = null) {
    const clone = element.cloneNode(true);
    if (exclude) {
      const cloneExclude = clone.querySelector(`#${exclude.id}`);
      if (cloneExclude) cloneExclude.remove();
    }
    return clone.textContent.trim().replace(/\s+/g, ' ').slice(0, 500);
  }

  /**
   * Helper: Get field label
   * @private
   */
  static _getFieldLabel(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return this._extractTextContent(label);
    }
    return element.placeholder || element.name || '';
  }

  /**
   * Helper: Score signal matches
   * @private
   */
  static _scoreSignals(text, keywords) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += keyword.split(' ').length;  // Longer phrases score higher
      }
    }
    return score;
  }

  /**
   * Batch analyze multiple fields
   * @param {Array<HTMLElement>} elements - Form field elements
   * @returns {Array<Object>} Analysis for each field
   */
  static analyzeFieldsContext(elements) {
    return elements.map(element => this.analyzeFieldContext(element));
  }

  /**
   * Similarity score between two context objects
   * @param {Object} context1 - First field context
   * @param {Object} context2 - Second field context
   * @returns {number} Similarity score 0-1
   */
  static contextSimilarity(context1, context2) {
    if (!context1 || !context2) return 0;

    let matches = 0;
    let total = 0;

    // Compare intents
    if (context1.intent === context2.intent) matches++;
    total++;

    // Compare entity types (set intersection)
    const types1 = new Set(context1.expectedEntityTypes);
    const types2 = new Set(context2.expectedEntityTypes);
    const intersection = new Set([...types1].filter(x => types2.has(x)));
    matches += intersection.size / Math.max(types1.size, types2.size);
    total++;

    return matches / total;
  }
}
