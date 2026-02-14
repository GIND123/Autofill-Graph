/**
 * EntityExtraction - Convert resume/document text into knowledge graph entities
 * Creates nodes and edges from unstructured document text
 */

import { GraphStorage } from './graphStorage.js';
import { DocumentParser } from './documentParser.js';
import { extractEntitiesBasic, extractKeywords, createNode, createEdge } from './utils.js';

export class EntityExtractor {
  /**
   * Process a resume document and populate the knowledge graph
   * @param {File} file - Resume file
   * @returns {Promise<Object>} Summary of extracted entities
   */
  static async processResume(file) {
    try {
      // Parse the file
      const text = await DocumentParser.parse(file);
      const sections = DocumentParser.extractSections(text);

      const summary = {
        nodesCreated: 0,
        edgesCreated: 0,
        entities: {
          skills: [],
          roles: [],
          organizations: [],
          achievements: []
        }
      };

      // Process each section
      if (sections.skills) {
        const skillsData = this._extractSkills(sections.skills);
        for (const skill of skillsData) {
          const node = createNode('skill', skill, { category: 'technical' }, 'resume');
          await GraphStorage.addNode(node);
          summary.entities.skills.push(skill);
          summary.nodesCreated++;
        }
      }

      if (sections.experience) {
        const experiences = this._extractExperience(sections.experience);
        const roleNodes = [];
        
        for (const exp of experiences) {
          // Create role node
          const roleNode = createNode(
            'role',
            exp.role,
            { organization: exp.organization, duration: exp.duration },
            'resume'
          );
          await GraphStorage.addNode(roleNode);
          roleNodes.push(roleNode);
          summary.entities.roles.push(exp.role);
          summary.nodesCreated++;

          // Create organization node if not exists
          if (exp.organization) {
            const orgNode = createNode('org', exp.organization, {}, 'resume');
            await GraphStorage.addNode(orgNode);
            
            // Create edge: role worked at organization
            const edge = createEdge(roleNode.id, orgNode.id, 'workedAt');
            await GraphStorage.addEdge(edge);
            summary.edgesCreated++;
          }

          // Link skills to this role
          for (const skill of exp.skills) {
            const skillNodes = await GraphStorage.searchNodesByLabel(skill);
            if (skillNodes.length > 0) {
              const skillNode = skillNodes[0];
              const edge = createEdge(roleNode.id, skillNode.id, 'hasSkill');
              await GraphStorage.addEdge(edge);
              summary.edgesCreated++;
            }
          }
        }
      }

      if (sections.education) {
        const education = this._extractEducation(sections.education);
        for (const edu of education) {
          const node = createNode(
            'education',
            edu.degree,
            { institution: edu.institution, year: edu.year },
            'resume'
          );
          await GraphStorage.addNode(node);
          summary.nodesCreated++;
        }
      }

      return summary;
    } catch (error) {
      throw new Error(`Resume processing failed: ${error.message}`);
    }
  }

  /**
   * Extract skill entities from skills section
   * @private
   */
  static _extractSkills(skillsSection) {
    const entities = extractEntitiesBasic(skillsSection);
    const skills = [...new Set(entities.skills)];
    
    // Remove duplicates and normalize
    return skills.map(skill => 
      skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase()
    );
  }

  /**
   * Extract work experience from experience section
   * @private
   */
  static _extractExperience(experienceSection) {
    const experiences = [];
    
    // Split by common experience separators
    const blocks = experienceSection.split(/(?=\b(?:Senior|Junior|Lead|Manager|Engineer|Developer|Architect|Analyst|Designer|Product|Director|Specialist|Consultant))/i);

    for (const block of blocks) {
      const experience = this._parseExperienceBlock(block);
      if (experience.role) {
        experiences.push(experience);
      }
    }

    return experiences;
  }

  /**
   * Parse a single experience block
   * @private
   */
  static _parseExperienceBlock(block) {
    const lines = block.split('\n').filter(l => l.trim());
    if (lines.length === 0) return {};

    const text = block.toLowerCase();
    const entities = extractEntitiesBasic(block);
    
    // Try to extract role from first meaningful line
    let role = '';
    for (const line of lines.slice(0, 3)) {
      const trimmed = line.trim();
      if (trimmed.length > 5) {
        role = trimmed;
        break;
      }
    }

    // Extract organization (look for company-like names in capital letters)
    const orgMatches = block.match(/[A-Z][A-Za-z\s&,.-]{2,}/);
    const organization = orgMatches ? orgMatches[0].trim() : '';

    // Extract duration (look for date patterns)
    const durationMatch = block.match(/(\d{4})\s*[-–]\s*(?:(\d{4})|present|current)/i);
    const duration = durationMatch ? `${durationMatch[1]}-${durationMatch[2] || 'Present'}` : '';

    return {
      role,
      organization,
      duration,
      skills: entities.skills,
      description: block.slice(0, 500)
    };
  }

  /**
   * Extract education entities
   * @private
   */
  static _extractEducation(educationSection) {
    const education = [];
    const blocks = educationSection.split(/(?=(?:B\.?S|B\.?A|M\.?S|M\.?B\.?A|Ph\.?D|Bachelor|Master|Doctorate))/i);

    for (const block of blocks) {
      const edu = this._parseEducationBlock(block);
      if (edu.degree) {
        education.push(edu);
      }
    }

    return education;
  }

  /**
   * Parse a single education block
   * @private
   */
  static _parseEducationBlock(block) {
    const text = block.trim();
    
    // Extract degree type
    const degreeMatch = text.match(/(Bachelor|Master|Ph\.?D|B\.?[AS]|M\.?[BS]\.?A?|Associate|Diploma)/i);
    const degree = degreeMatch ? degreeMatch[0] : '';

    // Extract field/major
    const fieldMatch = text.match(/(?:in|of)\s+([A-Za-z\s]+)(?:,|from|at|$)/i);
    const field = fieldMatch ? fieldMatch[1].trim() : '';

    // Extract institution
    const institutionMatches = text.match(/[A-Z][A-Za-z\s&,.-]{3,}(?:University|Institute|College|Academy)/i);
    const institution = institutionMatches ? institutionMatches[0] : '';

    // Extract year
    const yearMatch = text.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : '';

    return {
      degree: degree + (field ? ` in ${field}` : ''),
      institution,
      year,
      description: text.slice(0, 300)
    };
  }

  /**
   * Create inferred relationships between entities
   * Called after initial entity extraction to link related concepts
   */
  static async inferRelationships() {
    const allNodes = await GraphStorage.getAllNodes();
    const addedEdges = [];

    // Link similar skills
    const skillNodes = allNodes.filter(n => n.type === 'skill');
    for (let i = 0; i < skillNodes.length; i++) {
      for (let j = i + 1; j < skillNodes.length; j++) {
        if (this._areSimilarSkills(skillNodes[i].label, skillNodes[j].label)) {
          const edge = createEdge(
            skillNodes[i].id,
            skillNodes[j].id,
            'relatedTo',
            { similarity: 0.8 },
            true  // inferred
          );
          await GraphStorage.addEdge(edge);
          addedEdges.push(edge);
        }
      }
    }

    return { inferred: addedEdges.length };
  }

  /**
   * Check if two skill labels are similar
   * @private
   */
  static _areSimilarSkills(skill1, skill2) {
    const s1 = skill1.toLowerCase();
    const s2 = skill2.toLowerCase();

    // Check for common skill groupings
    const techGroups = [
      ['javascript', 'js', 'typescript', 'ts'],
      ['python', 'django', 'flask'],
      ['java', 'spring', 'kotlin'],
      ['react', 'vue', 'angular', 'frontend'],
      ['node', 'express', 'backend'],
      ['sql', 'mysql', 'postgres', 'database'],
      ['aws', 'azure', 'gcp', 'cloud'],
      ['docker', 'kubernetes', 'devops', 'ci/cd']
    ];

    for (const group of techGroups) {
      if (group.includes(s1) && group.includes(s2)) {
        return true;
      }
    }

    return false;
  }
}
