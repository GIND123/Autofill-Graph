/**
 * Knowledge Graph Manager v2 - Prototype2 Implementation
 * Based on AutoFillGraph v2 from Prototype2.ipynb
 *
 * Features:
 * - Typed temporal knowledge graph
 * - Multi-layer architecture (identity, contact, academic, professional, medical)
 * - Privacy-aware with sensitivity levels
 * - Deterministic resolvers + LLM fallback
 * - Inference registry
 * - Comprehensive field mapping with 100+ aliases
 * - Temporal history tracking
 */

// ═════════════════════════════════════════════════════════════════════════
// ENUMS AND TYPE DEFINITIONS
// ═════════════════════════════════════════════════════════════════════════

const EntityType = {
  PERSON: "PERSON",
  ORGANIZATION: "ORGANIZATION",
  LOCATION: "LOCATION",
  CREDENTIAL: "CREDENTIAL"
};

const Sensitivity = {
  PUBLIC: "PUBLIC",
  RESTRICTED: "RESTRICTED",
  ENCRYPTED: "ENCRYPTED"
};

const FillStatus = {
  FILLED: "FILLED",
  INFERRED: "INFERRED",
  GENERATED: "GENERATED",
  UNKNOWN: "UNKNOWN",
  NOT_APPLICABLE: "NOT_APPLICABLE"
};

// ═════════════════════════════════════════════════════════════════════════
// DATA CLASSES
// ═════════════════════════════════════════════════════════════════════════

class AttributeValue {
  constructor(value, property, options = {}) {
    this.value = value;
    this.property = property;
    this.valid_from = options.valid_from || new Date().toISOString();
    this.valid_until = options.valid_until || null;
    this.source = options.source || "user";
    this.layer = options.layer || "identity";
    this.sensitivity = options.sensitivity || Sensitivity.PUBLIC;
  }

  isCurrent() {
    const now = new Date();
    const validFrom = new Date(this.valid_from);
    if (now < validFrom) return false;
    if (this.valid_until) {
      const validUntil = new Date(this.valid_until);
      if (now >= validUntil) return false;
    }
    return true;
  }

  toJSON() {
    return {
      value: this.value,
      property: this.property,
      valid_from: this.valid_from,
      valid_until: this.valid_until,
      source: this.source,
      layer: this.layer,
      sensitivity: this.sensitivity
    };
  }
}

class InferredFact {
  constructor(field, value, rule, sourceFacts, confidence = 1.0) {
    this.field = field;
    this.value = value;
    this.rule = rule;
    this.source_facts = sourceFacts;
    this.confidence = confidence;
    this.generated_at = new Date().toISOString();
  }

  toJSON() {
    return {
      field: this.field,
      value: this.value,
      rule: this.rule,
      source_facts: this.source_facts,
      confidence: this.confidence,
      generated_at: this.generated_at
    };
  }
}

class FillResult {
  constructor(field, value, status, source, confidence = 1.0, inferenceChain = []) {
    this.field = field;
    this.value = value;
    this.status = status;
    this.source = source;
    this.confidence = confidence;
    this.inference_chain = inferenceChain;
  }

  toJSON() {
    return {
      field: this.field,
      value: this.value,
      status: this.status,
      source: this.source,
      confidence: this.confidence,
      inference_chain: this.inference_chain
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════
// LAYER DEFINITIONS
// ═════════════════════════════════════════════════════════════════════════

const LAYER_DEFINITIONS = {
  identity: {
    properties: ["full_name", "display_name", "aliases"],
    sensitivity: Sensitivity.PUBLIC
  },
  contact: {
    properties: ["email", "phone", "address", "city", "state", "zip", "country", "linkedin", "portfolio"],
    sensitivity: Sensitivity.PUBLIC
  },
  academic: {
    properties: ["university", "department", "degree", "gpa", "graduation_date", "thesis", "advisor"],
    sensitivity: Sensitivity.PUBLIC
  },
  professional: {
    properties: ["employer", "job_title", "skills", "years_experience", "work_email"],
    sensitivity: Sensitivity.PUBLIC
  },
  medical: {
    properties: ["insurance_provider", "policy_number", "blood_type", "allergies", "medications"],
    sensitivity: Sensitivity.RESTRICTED
  }
};

// ═════════════════════════════════════════════════════════════════════════
// FIELD MAPPER - Comprehensive field name mapping
// ═════════════════════════════════════════════════════════════════════════

class FieldMapper {
  constructor() {
    this.mappings = {
      full_name: ["full name", "full_name", "name", "candidate name", "legal name", "applicant name", "your name", "complete name"],
      first_name: ["first name", "first_name", "fname", "given name", "forename"],
      last_name: ["last name", "last_name", "lname", "surname", "family name"],
      email: ["email", "e-mail", "email address", "contact email", "work email", "personal email", "electronic mail"],
      phone: ["phone", "telephone", "phone number", "contact number", "mobile", "cell", "mobile number", "tel"],
      address: ["address", "street address", "mailing address", "home address", "residential address", "street"],
      city: ["city", "town", "municipality"],
      state: ["state", "province", "region", "territory"],
      zip: ["zip", "zip code", "postal code", "postcode", "pin code"],
      country: ["country", "nation", "country of residence"],
      university: ["university", "school", "institution", "college", "alma mater", "educational institution", "university name"],
      degree: ["degree", "education", "qualification", "program", "major", "degree program", "field of study"],
      gpa: ["gpa", "grade point average", "cgpa", "cumulative gpa", "academic score", "grades"],
      graduation_date: ["graduation date", "graduation", "completion date", "expected graduation", "grad date"],
      employer: ["employer", "company", "organization", "current employer", "workplace", "company name"],
      job_title: ["job title", "title", "position", "role", "current position", "designation"],
      skills: ["skills", "technical skills", "expertise", "competencies", "abilities", "technologies"],
      years_experience: ["years of experience", "experience", "work experience", "years experience", "total experience"],
      linkedin: ["linkedin", "linkedin profile", "linkedin url", "linkedin link"],
      portfolio: ["portfolio", "website", "personal website", "portfolio url", "github", "personal site"],
      bio: ["bio", "biography", "about", "description", "summary", "profile", "about you", "personal statement"],
      thesis: ["thesis", "thesis title", "dissertation", "research topic"],
      advisor: ["advisor", "supervisor", "thesis advisor", "faculty advisor"]
    };

    this.learnedMappings = {};
  }

  mapField(fieldLabel) {
    const normalized = fieldLabel.toLowerCase().trim();

    // Check direct mappings
    for (const [canonical, aliases] of Object.entries(this.mappings)) {
      if (aliases.some(alias => normalized === alias || normalized.includes(alias))) {
        return canonical;
      }
    }

    // Check learned mappings
    for (const [canonical, aliases] of Object.entries(this.learnedMappings)) {
      if (aliases.includes(normalized)) {
        return canonical;
      }
    }

    return null;
  }

  learnMapping(fieldLabel, canonicalProperty) {
    if (!this.learnedMappings[canonicalProperty]) {
      this.learnedMappings[canonicalProperty] = [];
    }
    const normalized = fieldLabel.toLowerCase().trim();
    if (!this.learnedMappings[canonicalProperty].includes(normalized)) {
      this.learnedMappings[canonicalProperty].push(normalized);
    }
  }

  getSensitivity(property) {
    for (const [layer, config] of Object.entries(LAYER_DEFINITIONS)) {
      if (config.properties.includes(property)) {
        return config.sensitivity;
      }
    }
    return Sensitivity.PUBLIC;
  }

  getLayer(property) {
    for (const [layer, config] of Object.entries(LAYER_DEFINITIONS)) {
      if (config.properties.includes(property)) {
        return layer;
      }
    }
    return "identity";
  }
}

// ═════════════════════════════════════════════════════════════════════════
// DETERMINISTIC RESOLVERS - Pattern-based extraction
// ═════════════════════════════════════════════════════════════════════════

class DeterministicResolvers {
  constructor() {
    this.EMAIL_DOMAIN_MAP = {
      "umd.edu": "University of Maryland",
      "stanford.edu": "Stanford University",
      "mit.edu": "Massachusetts Institute of Technology",
      "berkeley.edu": "UC Berkeley",
      "harvard.edu": "Harvard University",
      "yale.edu": "Yale University",
      "princeton.edu": "Princeton University",
      "columbia.edu": "Columbia University",
      "cornell.edu": "Cornell University",
      "upenn.edu": "University of Pennsylvania"
    };

    this.PHONE_COUNTRY_MAP = {
      "+1": "USA",
      "+91": "India",
      "+44": "UK",
      "+86": "China",
      "+81": "Japan",
      "+49": "Germany",
      "+33": "France",
      "+61": "Australia"
    };
  }

  resolveEmailDomain(email) {
    if (!email || typeof email !== 'string') return null;
    const domain = email.split('@')[1];
    if (!domain) return null;

    for (const [key, org] of Object.entries(this.EMAIL_DOMAIN_MAP)) {
      if (domain.toLowerCase().includes(key.toLowerCase())) {
        return org;
      }
    }
    return null;
  }

  resolvePhoneCountry(phone) {
    if (!phone || typeof phone !== 'string') return null;

    for (const [prefix, country] of Object.entries(this.PHONE_COUNTRY_MAP)) {
      if (phone.startsWith(prefix)) {
        return country;
      }
    }
    return null;
  }

  parseAddress(address) {
    if (!address || typeof address !== 'string') return {};

    const result = {};

    // Extract ZIP code
    const zipMatch = address.match(/\b\d{5}(-\d{4})?\b/);
    if (zipMatch) {
      result.zip = zipMatch[0];
    }

    // Extract state (2-letter code)
    const stateMatch = address.match(/\b[A-Z]{2}\b/);
    if (stateMatch) {
      result.state = stateMatch[0];
    }

    // Extract city (word before state)
    const cityMatch = address.match(/,\s*([^,]+)\s+[A-Z]{2}\b/);
    if (cityMatch) {
      result.city = cityMatch[1].trim();
    }

    return result;
  }

  detectValueType(key, value) {
    const keyLower = key.toLowerCase();

    if (keyLower.includes('email') && typeof value === 'string' && value.includes('@')) {
      return 'email';
    }
    if ((keyLower.includes('phone') || keyLower.includes('tel')) && typeof value === 'string') {
      return 'phone';
    }
    if (keyLower.includes('gpa') || keyLower.includes('grade')) {
      return 'gpa';
    }
    if (keyLower.includes('date')) {
      return 'date';
    }

    return 'text';
  }
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN KNOWLEDGE GRAPH MANAGER
// ═════════════════════════════════════════════════════════════════════════

class KnowledgeGraphManager {
  constructor(apiKey) {
    this.apiKey = apiKey;

    // Graph structure
    this.entities = new Map(); // entity_id -> {type, display_name, aliases, created_at}
    this.attributes = new Map(); // entity_id -> property -> [AttributeValue]
    this.relations = []; // [{head, tail, relation, created_at}]
    this.inferences = []; // [InferredFact]

    // Helper classes
    this.fieldMapper = new FieldMapper();
    this.resolvers = new DeterministicResolvers();

    // Stats
    this.stats = {
      facts_stored: 0,
      facts_inferred: 0,
      api_calls: 0,
      local_fills: 0,
      api_fills: 0
    };

    // Ensure user entity exists
    this.ensureEntity("user", EntityType.PERSON, "User");
  }

  // ─────────────────────────────────────────────────────────────────
  // ENTITY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  ensureEntity(entityId, entityType, displayName = null, aliases = []) {
    entityId = this.canonicalId(entityId);

    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, {
        type: entityType,
        display_name: displayName || entityId,
        aliases: aliases,
        created_at: new Date().toISOString()
      });
    }

    return entityId;
  }

  canonicalId(name) {
    return name.toLowerCase().replace(/\s+/g, '_');
  }

  addRelation(head, tail, relation) {
    head = this.canonicalId(head);
    tail = this.canonicalId(tail);

    // Check if relation already exists
    const exists = this.relations.some(
      r => r.head === head && r.tail === tail && r.relation === relation
    );

    if (!exists) {
      this.relations.push({
        head,
        tail,
        relation,
        created_at: new Date().toISOString()
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ATTRIBUTE STORAGE (WITH TEMPORAL SUPPORT)
  // ─────────────────────────────────────────────────────────────────

  storeAttribute(entityId, property, value, options = {}) {
    entityId = this.canonicalId(entityId);

    if (!this.attributes.has(entityId)) {
      this.attributes.set(entityId, new Map());
    }

    const entityAttrs = this.attributes.get(entityId);
    if (!entityAttrs.has(property)) {
      entityAttrs.set(property, []);
    }

    const attrValue = new AttributeValue(value, property, {
      valid_from: options.valid_from,
      valid_until: options.valid_until,
      source: options.source || "user",
      layer: this.fieldMapper.getLayer(property),
      sensitivity: this.fieldMapper.getSensitivity(property)
    });

    entityAttrs.get(property).push(attrValue);
    this.stats.facts_stored++;
  }

  getCurrentAttributes(entityId, maxSensitivity = Sensitivity.PUBLIC) {
    entityId = this.canonicalId(entityId);

    const result = {};
    const entityAttrs = this.attributes.get(entityId);

    if (!entityAttrs) return result;

    for (const [property, values] of entityAttrs.entries()) {
      // Filter by sensitivity and current validity
      const currentValues = values.filter(v => {
        if (!v.isCurrent()) return false;

        // Check sensitivity level
        if (maxSensitivity === Sensitivity.PUBLIC && v.sensitivity !== Sensitivity.PUBLIC) {
          return false;
        }
        if (maxSensitivity === Sensitivity.RESTRICTED && v.sensitivity === Sensitivity.ENCRYPTED) {
          return false;
        }

        return true;
      });

      if (currentValues.length > 0) {
        // Return most recent value
        const sorted = currentValues.sort((a, b) =>
          new Date(b.valid_from) - new Date(a.valid_from)
        );
        result[property] = sorted[0].value;
      }
    }

    return result;
  }

  getAttributeHistory(entityId, property) {
    entityId = this.canonicalId(entityId);

    const entityAttrs = this.attributes.get(entityId);
    if (!entityAttrs || !entityAttrs.has(property)) {
      return [];
    }

    return entityAttrs.get(property).map(v => v.toJSON());
  }

  // ─────────────────────────────────────────────────────────────────
  // INFERENCE REGISTRY
  // ─────────────────────────────────────────────────────────────────

  storeInference(field, value, rule, sourceFacts, confidence = 1.0) {
    const inference = new InferredFact(field, value, rule, sourceFacts, confidence);
    this.inferences.push(inference);
    this.stats.facts_inferred++;
    return inference;
  }

  getInferences() {
    return this.inferences.map(i => i.toJSON());
  }

  getTemporalHistory() {
    const history = {};

    for (const [entityId, entityAttrs] of this.attributes.entries()) {
      for (const [property, values] of entityAttrs.entries()) {
        if (values.length > 1) {
          history[property] = values
            .map(v => v.toJSON())
            .sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from));
        }
      }
    }

    return history;
  }

  getPrivacyBreakdown() {
    const breakdown = {
      public: 0,
      restricted: 0,
      encrypted: 0
    };

    for (const entityAttrs of this.attributes.values()) {
      for (const values of entityAttrs.values()) {
        for (const attr of values) {
          if (attr.isCurrent()) {
            if (attr.sensitivity === Sensitivity.PUBLIC) {
              breakdown.public++;
            } else if (attr.sensitivity === Sensitivity.RESTRICTED) {
              breakdown.restricted++;
            } else if (attr.sensitivity === Sensitivity.ENCRYPTED) {
              breakdown.encrypted++;
            }
          }
        }
      }
    }

    return breakdown;
  }

  // ─────────────────────────────────────────────────────────────────
  // LEARN FROM FORM (4-STEP INGESTION)
  // ─────────────────────────────────────────────────────────────────

  async learnFromForm(formData, context = "General Info") {
    try {
      console.log("Learning from form with data:", formData);
      const triples = [];

      // STEP 1: Deterministic resolution
      const resolvedData = await this.applyDeterministicResolvers(formData);

      // STEP 2: Store direct attributes
      for (const [key, value] of Object.entries(formData)) {
        if (!value || value.trim() === '') continue;

        const canonical = this.fieldMapper.mapField(key);
        if (canonical) {
          this.storeAttribute("user", canonical, value, { source: context });
          triples.push({ head: "User", relation: "HAS_" + canonical.toUpperCase(), tail: value });
        } else {
          // Store with original key if no mapping found
          this.storeAttribute("user", key.toLowerCase().replace(/\s+/g, '_'), value, { source: context });
        }
      }

      // STEP 3: Store resolved inferences
      for (const [field, value] of Object.entries(resolvedData)) {
        if (value && value !== 'UNKNOWN') {
          this.storeAttribute("user", field, value, { source: context + " (inferred)" });
          triples.push({ head: "User", relation: "INFERRED_" + field.toUpperCase(), tail: value });
        }
      }

      // STEP 4: LLM extraction (if API key available)
      if (this.apiKey) {
        try {
          const llmTriples = await this.extractWithLLM(formData, context);
          triples.push(...llmTriples);

          // Store LLM-extracted entities and relations
          for (const triple of llmTriples) {
            if (triple.head && triple.tail && triple.relation) {
              // Create entities
              this.ensureEntity(this.canonicalId(triple.head), EntityType.PERSON, triple.head);
              this.ensureEntity(this.canonicalId(triple.tail), this.guessEntityType(triple.tail), triple.tail);

              // Add relation
              this.addRelation(triple.head, triple.tail, triple.relation);
            }
          }
        } catch (apiError) {
          console.warn("LLM extraction failed, continuing with deterministic data:", apiError.message);
        }
      }

      console.log(`Learned ${this.stats.facts_stored} facts (${this.stats.facts_inferred} inferred)`);
      return triples;
    } catch (error) {
      console.error("Error learning from form:", error);
      return [];
    }
  }

  async applyDeterministicResolvers(formData) {
    const resolved = {};

    // Extract email and resolve university
    const email = formData.email || formData.Email || formData["Email Address"];
    if (email) {
      const university = this.resolvers.resolveEmailDomain(email);
      if (university) {
        resolved.university = university;
        this.storeInference("university", university, "email_domain", [email], 0.9);
      }
    }

    // Extract phone and resolve country
    const phone = formData.phone || formData.Phone || formData["Phone Number"];
    if (phone) {
      const country = this.resolvers.resolvePhoneCountry(phone);
      if (country) {
        resolved.country = country;
        this.storeInference("country", country, "phone_prefix", [phone], 0.9);
      }
    }

    // Parse address
    const address = formData.address || formData.Address || formData["Street Address"];
    if (address) {
      const parsed = this.resolvers.parseAddress(address);
      Object.assign(resolved, parsed);

      if (parsed.city) {
        this.storeInference("city", parsed.city, "address_parsing", [address], 0.8);
      }
      if (parsed.state) {
        this.storeInference("state", parsed.state, "address_parsing", [address], 0.8);
      }
      if (parsed.zip) {
        this.storeInference("zip", parsed.zip, "address_parsing", [address], 0.95);
      }
    }

    return resolved;
  }

  async extractWithLLM(formData, context) {
    const prompt = `You are a Knowledge Graph Architect.
Extract entities and relationships from this form data.

Data: ${JSON.stringify(formData)}
Context: ${context}

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "triples": [
    {"head": "Entity1", "relation": "RELATION", "tail": "Entity2"}
  ]
}

Rules:
- Use canonical names (e.g., "University of Maryland" not "UMD")
- Add 'User' as the central node
- Focus on professional and educational information`;

    const response = await this.callMistralAPI(prompt);
    this.stats.api_calls++;
    return response.triples || [];
  }

  guessEntityType(value) {
    const lower = value.toLowerCase();
    if (lower.includes('university') || lower.includes('college') || lower.includes('school')) {
      return EntityType.ORGANIZATION;
    }
    if (lower.includes('city') || lower.includes('state') || lower.includes('country')) {
      return EntityType.LOCATION;
    }
    return EntityType.CREDENTIAL;
  }

  // ─────────────────────────────────────────────────────────────────
  // AUTOFILL (TWO-PHASE: LOCAL FIRST, THEN LLM)
  // ─────────────────────────────────────────────────────────────────

  async autofillForm(formFields) {
    try {
      if (this.stats.facts_stored === 0) {
        console.log("Graph is empty. Cannot autofill.");
        return {};
      }

      console.log(`Autofilling ${formFields.length} fields...`);

      // PHASE 1: Local matching (deterministic)
      const localResults = this.localAutofill(formFields);
      const filledFields = new Set(Object.keys(localResults));

      console.log(`Phase 1 (Local): Filled ${filledFields.size}/${formFields.length} fields`);
      this.stats.local_fills += filledFields.size;

      // PHASE 2: LLM for remaining fields (if API key available)
      let llmResults = {};
      const remainingFields = formFields.filter(f => !filledFields.has(f));

      if (this.apiKey && remainingFields.length > 0) {
        try {
          llmResults = await this.llmAutofill(remainingFields);
          console.log(`Phase 2 (LLM): Filled ${Object.keys(llmResults).length}/${remainingFields.length} remaining fields`);
          this.stats.api_fills += Object.keys(llmResults).length;
        } catch (apiError) {
          console.warn("LLM autofill failed:", apiError.message);
        }
      }

      // Merge results
      const finalResults = { ...localResults, ...llmResults };
      console.log(`Total filled: ${Object.keys(finalResults).length}/${formFields.length} fields`);

      return finalResults;
    } catch (error) {
      console.error("Error autofilling form:", error);
      return {};
    }
  }

  localAutofill(formFields) {
    const results = {};
    const currentAttrs = this.getCurrentAttributes("user");

    for (const field of formFields) {
      const canonical = this.fieldMapper.mapField(field);

      if (canonical && currentAttrs[canonical]) {
        results[field] = currentAttrs[canonical];
      } else {
        // Try direct match
        const fieldKey = field.toLowerCase().replace(/\s+/g, '_');
        if (currentAttrs[fieldKey]) {
          results[field] = currentAttrs[fieldKey];
        }
      }
    }

    return results;
  }

  async llmAutofill(formFields) {
    const currentAttrs = this.getCurrentAttributes("user");
    const graphContext = this.relations.map(r =>
      `(${r.head}) -[${r.relation}]-> (${r.tail})`
    );

    // Add current attributes to context
    const attrContext = Object.entries(currentAttrs).map(([k, v]) => `${k}: ${v}`);

    const prompt = `You are an Autofill Agent. Fill these form fields using the knowledge graph.

FIELDS TO FILL:
${formFields.map((f, i) => `${i + 1}. ${f}`).join("\n")}

KNOWLEDGE (User attributes):
${attrContext.join("\n")}

RELATIONSHIPS:
${graphContext.slice(0, 20).join("\n")}

Return ONLY valid JSON (no markdown):
{
  "filled": {
    "field_name": "value_from_graph"
  }
}

Rules:
- Use exact field names from the query
- Only use information from the knowledge
- Return "UNKNOWN" for fields you cannot fill
- Be consistent with names, emails, and professional info`;

    const response = await this.callMistralAPI(prompt);
    this.stats.api_calls++;
    return response.filled || {};
  }

  // ─────────────────────────────────────────────────────────────────
  // MISTRAL API
  // ─────────────────────────────────────────────────────────────────

  async _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async _fetchWithRetry(url, options, { retries = 3, backoffMs = 2000 } = {}) {
    let lastErr = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, options);

        // Retry on transient server errors and rate limits.
        if (!res.ok && (res.status === 429 || (res.status >= 500 && res.status <= 599))) {
          const errorText = await res.text().catch(() => "");
          lastErr = new Error(`HTTP ${res.status} - ${errorText}`);
        } else {
          return res;
        }
      } catch (e) {
        lastErr = e;
      }

      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt); // 2s, 4s, 8s...
        await this._sleep(delay);
      }
    }

    throw lastErr || new Error("Request failed after retries");
  }

  async _callMistralChatCompletions({ model, messages, responseFormat } = {}) {
    if (!this.apiKey) {
      throw new Error("API key not configured");
    }

    const body = {
      model,
      messages,
      temperature: 0
    };

    if (responseFormat) {
      body.response_format = responseFormat;
    }

    const response = await this._fetchWithRetry(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      },
      { retries: 3, backoffMs: 2000 }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || "").trim();
    return { data, content };
  }

  async callMistralAPI(prompt) {
    const { content } = await this._callMistralChatCompletions({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" }
    });

    return JSON.parse(content);
  }

  // Optional: OCR/vision fallback. Call this only when local OCR is weak/unavailable.
  // `imageDataUrl` should be a data URL like "data:image/png;base64,....".
  async callMistralVisionOCR({ imageDataUrl, task = "Extract all visible form field labels and any nearby hints." } = {}) {
    if (!imageDataUrl) {
      throw new Error("imageDataUrl is required");
    }

    const prompt = `You are an OCR + form understanding assistant.
Task: ${task}
Return ONLY valid JSON (no markdown):
{
  "text": "full extracted text",
  "fields": ["Field label 1", "Field label 2"]
}`;

    // NOTE: This assumes the deployed Mistral model accepts multimodal "image_url" content.
    // If your Mistral account/model requires a different format/endpoint, adjust here.
    const { content } = await this._callMistralChatCompletions({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: imageDataUrl }
          ]
        }
      ],
      responseFormat: { type: "json_object" }
    });

    this.stats.api_calls++;
    return JSON.parse(content);
  }

  // ─────────────────────────────────────────────────────────────────
  // STATS & SERIALIZATION
  // ─────────────────────────────────────────────────────────────────

  getStats() {
    // Count current vs expired attributes
    let currentFacts = 0;
    let expiredFacts = 0;

    for (const entityAttrs of this.attributes.values()) {
      for (const values of entityAttrs.values()) {
        for (const attr of values) {
          if (attr.isCurrent()) {
            currentFacts++;
          } else {
            expiredFacts++;
          }
        }
      }
    }

    return {
      entities: this.entities.size,
      relations: this.relations.length,
      facts_stored: this.stats.facts_stored,
      facts_current: currentFacts,
      facts_expired: expiredFacts,
      facts_inferred: this.stats.facts_inferred,
      api_calls: this.stats.api_calls,
      local_fills: this.stats.local_fills,
      api_fills: this.stats.api_fills,

      // For UI display
      nodeCount: this.entities.size,
      edgeCount: this.relations.length,
      nodes: Array.from(this.entities.keys()),
      edges: this.relations
    };
  }

  serialize() {
    return {
      entities: Array.from(this.entities.entries()),
      attributes: Array.from(this.attributes.entries()).map(([entityId, attrs]) => [
        entityId,
        Array.from(attrs.entries()).map(([prop, values]) => [
          prop,
          values.map(v => v.toJSON())
        ])
      ]),
      relations: this.relations,
      inferences: this.inferences.map(i => i.toJSON()),
      stats: this.stats,
      learnedMappings: this.fieldMapper.learnedMappings,
      timestamp: Date.now()
    };
  }

  async deserialize(data) {
    // Restore entities
    this.entities = new Map(data.entities || []);

    // Restore attributes
    if (data.attributes) {
      this.attributes = new Map(
        data.attributes.map(([entityId, attrs]) => [
          entityId,
          new Map(
            attrs.map(([prop, values]) => [
              prop,
              values.map(v => {
                const attr = new AttributeValue(v.value, v.property, {
                  valid_from: v.valid_from,
                  valid_until: v.valid_until,
                  source: v.source,
                  layer: v.layer,
                  sensitivity: v.sensitivity
                });
                return attr;
              })
            ])
          )
        ])
      );
    }

    // Restore relations
    this.relations = data.relations || [];

    // Restore inferences
    if (data.inferences) {
      this.inferences = data.inferences.map(i => {
        const inf = new InferredFact(i.field, i.value, i.rule, i.source_facts, i.confidence);
        inf.generated_at = i.generated_at;
        return inf;
      });
    }

    // Restore stats
    this.stats = data.stats || this.stats;

    // Restore learned mappings
    if (data.learnedMappings) {
      this.fieldMapper.learnedMappings = data.learnedMappings;
    }
  }
}

// Export for use in scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = KnowledgeGraphManager;
}
