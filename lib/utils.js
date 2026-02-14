/**
 * Utility functions for the autofill system
 */

/**
 * Generate a unique ID using timestamp and random component
 * @returns {string} Unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a graph node
 * @param {Object} data - Node data
 * @returns {Object} Complete node object
 */
export function createNode(type, label, properties = {}, source = 'user_input') {
  return {
    id: generateId(),
    type,
    label,
    description: '',
    properties,
    metadata: {
      createdAt: Date.now(),
      source,
      confidence: source === 'user_input' ? 1.0 : 0.8,
      frequency: 1
    }
  };
}

/**
 * Create a graph edge/relationship
 * @param {Object} data - Edge data
 * @returns {Object} Complete edge object
 */
export function createEdge(source, target, type, properties = {}, inferred = false) {
  return {
    id: generateId(),
    source,
    target,
    type,
    properties,
    metadata: {
      inferred,
      confidence: inferred ? 0.7 : 1.0,
      updatedAt: Date.now()
    }
  };
}

/**
 * Extract keywords from text
 * @param {string} text - Text to analyze
 * @returns {Array<string>} Array of keywords
 */
export function extractKeywords(text) {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
    'those', 'it', 'its', 'what', 'which', 'who', 'when', 'where', 'why'
  ]);

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word))
    .map(word => word.replace(/[^a-z0-9]/g, ''));

  return [...new Set(words)];
}

/**
 * Extract entities using simple pattern matching
 * Looks for common professional entities
 * @param {string} text - Text to analyze
 * @returns {Object} Extracted entities
 */
export function extractEntitiesBasic(text) {
  const entities = {
    skills: [],
    organizations: [],
    roles: [],
    dates: []
  };

  // Common skill keywords
  const skillPatterns = [
    'javascript', 'python', 'java', 'css', 'html', 'react', 'angular', 'node',
    'sql', 'database', 'api', 'rest', 'microservices', 'docker', 'kubernetes',
    'aws', 'gcp', 'azure', 'git', 'agile', 'scrum', 'leadership', 'communication',
    'project management', 'data analysis', 'machine learning', 'ai', 'nlp',
    'typescript', 'golang', 'rust', 'c++', 'devops', 'ci/cd', 'jenkins'
  ];

  const rolePatterns = [
    'engineer', 'developer', 'lead', 'manager', 'architect', 'analyst',
    'designer', 'product', 'director', 'specialist', 'consultant', 'coordinator',
    'officer', 'representative', 'associate', 'senior', 'junior', 'intern'
  ];

  const lowerText = text.toLowerCase();

  // Extract skills
  for (const skill of skillPatterns) {
    if (lowerText.includes(skill)) {
      entities.skills.push(skill);
    }
  }

  // Extract roles
  for (const role of rolePatterns) {
    const regex = new RegExp(`\\b${role}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      entities.roles.push(...matches.map(m => m.trim()));
    }
  }

  // Extract dates (YYYY-MM-DD, Month YYYY, etc.)
  const dateRegex = /(\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
  const dates = text.match(dateRegex) || [];
  entities.dates.push(...dates);

  // Remove duplicates and return
  return {
    skills: [...new Set(entities.skills)],
    organizations: entities.organizations,
    roles: [...new Set(entities.roles)],
    dates: [...new Set(entities.dates)]
  };
}

/**
 * Sanitize input string
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
export function sanitize(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/<[^>]*>/g, '').slice(0, 10000);
}

/**
 * Validate entity type
 * @param {string} type - Entity type
 * @returns {boolean} True if valid
 */
export function isValidEntityType(type) {
  const validTypes = [
    'skill', 'role', 'org', 'project', 'achievement',
    'education', 'tech_skill', 'soft_skill'
  ];
  return validTypes.includes(type);
}

/**
 * Validate edge type
 * @param {string} type - Edge type
 * @returns {boolean} True if valid
 */
export function isValidEdgeType(type) {
  const validTypes = [
    'hasSkill', 'workedAt', 'ledTeam', 'usedTechnology',
    'achieved', 'relatedTo', 'demonstrates', 'requires'
  ];
  return validTypes.includes(type);
}
