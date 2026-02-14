/**
 * NarrativeGenerator - Generate coherent narratives from knowledge graph
 * Creates natural language responses for open-ended form questions
 */

import { GraphStorage } from './graphStorage.js';
import { GraphQuery } from './graphQuery.js';

export class NarrativeGenerator {
  /**
   * Generate a narrative response for a form field
   * @param {string} fieldPrompt - The form field question/prompt
   * @param {string} sourceNodeId - ID of the primary entity to base narrative on
   * @param {number} maxLength - Maximum response length in words
   * @returns {Promise<string>} Generated narrative
   */
  static async generateNarrative(fieldPrompt, sourceNodeId, maxLength = 150) {
    try {
      const sourceNode = await GraphStorage.getNode(sourceNodeId);
      if (!sourceNode) {
        throw new Error('Source node not found');
      }

      // Get context around the source node
      const context = await GraphQuery.getNodeContext(sourceNodeId);
      const relatedNodes = await GraphQuery.findRelated(sourceNodeId, 2);

      // Generate based on node type
      let narrative = '';

      switch (sourceNode.type) {
        case 'role':
          narrative = this._generateRoleNarrative(sourceNode, context, relatedNodes);
          break;
        case 'project':
          narrative = this._generateProjectNarrative(sourceNode, context, relatedNodes);
          break;
        case 'achievement':
          narrative = this._generateAchievementNarrative(sourceNode, context, relatedNodes);
          break;
        default:
          narrative = this._generateGenericNarrative(sourceNode, context);
      }

      // Trim to max length
      return this._trimToLength(narrative, maxLength);
    } catch (error) {
      console.error('Narrative generation failed:', error);
      return '';
    }
  }

  /**
   * Generate narrative for a role
   * @private
   */
  static _generateRoleNarrative(node, context, relatedIds) {
    let narrative = `As a ${node.label}`;

    // Add organization if available
    if (node.properties?.organization) {
      narrative += ` at ${node.properties.organization}`;
    }

    // Add duration
    if (node.properties?.duration) {
      narrative += ` (${node.properties.duration})`;
    }

    narrative += ', ';

    // Add key accomplishments/skills from outgoing edges
    const skillEdges = context.outgoing.filter(e => e.type === 'hasSkill' || e.type === 'usedTechnology');
    const skills = skillEdges.slice(0, 3).map(e => e.targetNode?.label).filter(Boolean);

    if (skills.length > 0) {
      narrative += `I specialized in ${skills.join(', ')}. `;
    }

    // Add related achievements or projects
    const achievementEdges = context.outgoing.filter(e => e.type === 'achieved');
    if (achievementEdges.length > 0) {
      const achievement = achievementEdges[0].targetNode?.label;
      if (achievement) {
        narrative += `Key achievement: ${achievement}.`;
      }
    }

    return narrative;
  }

  /**
   * Generate narrative for a project
   * @private
   */
  static _generateProjectNarrative(node, context, relatedIds) {
    let narrative = `I led the ${node.label} project`;

    // Add description from properties
    if (node.description) {
      narrative += `: ${node.description}.`;
    } else {
      narrative += '.';
    }

    // Add technologies/skills used
    const techEdges = context.outgoing.filter(e => e.type === 'usedTechnology');
    const techs = techEdges.slice(0, 3).map(e => e.targetNode?.label).filter(Boolean);

    if (techs.length > 0) {
      narrative += ` Technologies: ${techs.join(', ')}.`;
    }

    // Add outcomes/achievements
    const outcomes = context.outgoing.filter(e => e.type === 'achieved');
    if (outcomes.length > 0) {
      const outcome = outcomes[0].targetNode?.label;
      if (outcome) {
        narrative += ` Result: ${outcome}.`;
      }
    }

    return narrative;
  }

  /**
   * Generate narrative for an achievement
   * @private
   */
  static _generateAchievementNarrative(node, context, relatedIds) {
    let narrative = `I achieved ${node.label}`;

    if (node.description) {
      narrative += `: ${node.description}`;
    }

    // Add related context
    const relatedEdges = context.incoming.slice(0, 2);
    if (relatedEdges.length > 0) {
      const relatedItems = relatedEdges.map(e => e.sourceNode?.label).filter(Boolean);
      if (relatedItems.length > 0) {
        narrative += ` through ${relatedItems.join(' and ')}.`;
      }
    }

    return narrative;
  }

  /**
   * Generic narrative for other entity types
   * @private
   */
  static _generateGenericNarrative(node, context) {
    let narrative = node.label;

    if (node.description) {
      narrative += `: ${node.description}`;
    }

    return narrative;
  }

  /**
   * Trim narrative to word limit
   * @private
   */
  static _trimToLength(text, maxWords) {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) {
      return text;
    }

    const trimmed = words.slice(0, maxWords).join(' ');
    // Add ellipsis if we had to cut off
    const lastPunctuation = trimmed.match(/[.!?]$/);
    return lastPunctuation ? trimmed : trimmed + '...';
  }

  /**
   * Generate multiple narrative options for a field
   * @param {string} fieldPrompt - Form field prompt
   * @param {Array<string>} nodeIds - Multiple source node IDs
   * @returns {Promise<Array>} Array of narrative options
   */
  static async generateNarrativeOptions(fieldPrompt, nodeIds, maxLength = 150) {
    const narratives = await Promise.all(
      nodeIds.map(id => this.generateNarrative(fieldPrompt, id, maxLength))
    );

    return narratives.filter(n => n.length > 0);
  }

  /**
   * Enhance narrative with LLM (if available)
   * This would call the background worker to refine the narrative
   * @param {string} narrative - Generated narrative
   * @param {string} fieldPrompt - Original form field prompt
   * @returns {Promise<string>} Enhanced narrative
   */
  static async enhanceWithLLM(narrative, fieldPrompt) {
    try {
      // Send message to background worker to enhance with LLM
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'ENHANCE_NARRATIVE',
            data: { narrative, prompt: fieldPrompt }
          },
          (response) => {
            if (response?.enhanced) {
              resolve(response.enhanced);
            } else {
              resolve(narrative);  // Fallback to original
            }
          }
        );
      });
    } catch (error) {
      console.error('LLM enhancement failed:', error);
      return narrative;
    }
  }
}
