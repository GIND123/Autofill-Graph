/**
 * GraphLearning - Update knowledge graph based on user feedback
 * Implements continuous learning mechanisms
 */

import { GraphStorage } from './graphStorage.js';
import { FeedbackManager } from './feedbackManager.js';

export class GraphLearning {
  /**
   * Process feedback and update graph confidence scores
   * @param {string} feedbackId - ID of feedback to process
   * @returns {Promise<Object>} Updates applied
   */
  static async processFeedback(feedbackId) {
    const feedback = await this._getFeedbackById(feedbackId);
    if (!feedback) {
      throw new Error('Feedback not found');
    }

    const updates = {
      nodesUpdated: 0,
      edgesUpdated: 0,
      newNodesCreated: 0,
      details: []
    };

    // Update source node confidence based on feedback
    if (feedback.sourceNodeId) {
      const node = await GraphStorage.getNode(feedback.sourceNodeId);
      if (node) {
        const updated = this._updateNodeConfidence(node, feedback);
        await GraphStorage.addNode(updated);
        updates.nodesUpdated++;
        updates.details.push(`Updated confidence for ${node.label}`);
      }
    }

    // If user corrected the suggestion, create new entity if needed
    if (feedback.feedback === 'incorrect' && feedback.userEdit) {
      // Check if user's edit is something new
      if (!await this._entityExists(feedback.userEdit)) {
        // Create new entity based on user input
        const newNode = await this._createEntityFromUserInput(
          feedback.userEdit,
          feedback.sourceNodeId
        );
        updates.newNodesCreated++;
        updates.details.push(`Created new entity: ${newNode.label}`);
      }
    }

    // Update frequency metadata
    if (feedback.sourceNodeId) {
      const node = await GraphStorage.getNode(feedback.sourceNodeId);
      if (node) {
        node.metadata.frequency = (node.metadata.frequency || 0) + 1;
        await GraphStorage.addNode(node);
      }
    }

    return updates;
  }

  /**
   * Process all pending feedback
   * @returns {Promise<Object>} Summary of all updates
   */
  static async processAllFeedback() {
    const history = await FeedbackManager.getFeedbackHistory();
    const summary = {
      processed: 0,
      errors: 0,
      totalUpdates: {
        nodesUpdated: 0,
        edgesUpdated: 0,
        newNodesCreated: 0
      }
    };

    for (const feedback of history) {
      try {
        const result = await this.processFeedback(feedback.id);
        summary.processed++;
        summary.totalUpdates.nodesUpdated += result.nodesUpdated;
        summary.totalUpdates.edgesUpdated += result.edgesUpdated;
        summary.totalUpdates.newNodesCreated += result.newNodesCreated;
      } catch (error) {
        console.error(`Error processing feedback ${feedback.id}:`, error);
        summary.errors++;
      }
    }

    return summary;
  }

  /**
   * Refine relationship confidence based on patterns
   * If a relationship consistently leads to correct suggestions, increase confidence
   */
  static async refineRelationshipWeights() {
    const edges = await GraphStorage.getAllEdges();
    let updated = 0;

    for (const edge of edges) {
      const sourceNodeFeedback = await FeedbackManager.getFeedbackForNode(edge.source);
      
      // Check if this edge led to correct suggestions
      const correctUses = sourceNodeFeedback.filter(
        f => f.feedback === 'correct' && f.affectedNodeIds?.includes(edge.target)
      ).length;

      if (correctUses > 2) {
        // This edge appears to be useful
        edge.metadata.confidence = Math.min((edge.metadata.confidence || 0.7) + 0.05, 1.0);
        await GraphStorage.addEdge(edge);
        updated++;
      }
    }

    return { edgesRefined: updated };
  }

  /**
   * Update node confidence based on feedback verdict
   * @private
   */
  static _updateNodeConfidence(node, feedback) {
    const currentConfidence = node.metadata.confidence || 0.8;
    let adjustment = 0;

    switch (feedback.feedback) {
      case 'correct':
        adjustment = +0.05;  // Increase confidence
        break;
      case 'partially_correct':
        adjustment = +0.02;  // Small increase
        break;
      case 'incorrect':
        adjustment = -0.1;   // Decrease confidence
        break;
      case 'ignored':
        adjustment = -0.02;  // Small decrease
        break;
    }

    const newConfidence = Math.max(0.3, Math.min(1.0, currentConfidence + adjustment));
    
    return {
      ...node,
      metadata: {
        ...node.metadata,
        confidence: newConfidence,
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Check if an entity with given label already exists
   * @private
   */
  static async _entityExists(label) {
    const results = await GraphStorage.searchNodesByLabel(label);
    return results.length > 0;
  }

  /**
   * Create a new node from user input
   * @private
   */
  static async _createEntityFromUserInput(label, relatedNodeId) {
    const node = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: label.trim(),
      type: 'skill',  // Default type, could be refined
      description: 'Created from user feedback',
      properties: {},
      metadata: {
        createdAt: Date.now(),
        source: 'user_feedback',
        confidence: 0.8,
        frequency: 1
      }
    };

    await GraphStorage.addNode(node);

    // Create edge from related node if provided
    if (relatedNodeId) {
      const edge = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: relatedNodeId,
        target: node.id,
        type: 'hasSkill',
        properties: { learned_from_feedback: true },
        metadata: {
          inferred: true,
          confidence: 0.7,
          updatedAt: Date.now()
        }
      };
      await GraphStorage.addEdge(edge);
    }

    return node;
  }

  /**
   * Get feedback by ID
   * @private
   */
  static async _getFeedbackById(feedbackId) {
    const history = await FeedbackManager.getFeedbackHistory();
    return history.find(f => f.id === feedbackId);
  }

  /**
   * Detect patterns in feedback
   * Identifies which fields/suggestions are consistently wrong
   * @returns {Promise<Object>} Pattern analysis
   */
  static async analyzePatterns() {
    const stats = await FeedbackManager.getStatistics();
    const patterns = {
      problematicFields: [],
      accurateFields: [],
      averageAccuracy: stats.correct / Math.max(stats.total, 1)
    };

    for (const [fieldId, fieldStats] of Object.entries(stats.feedbackByField)) {
      const accuracy = fieldStats.correct / Math.max(fieldStats.total, 1);
      
      if (accuracy < 0.5 && fieldStats.total >= 3) {
        patterns.problematicFields.push({
          fieldId,
          accuracy,
          attempts: fieldStats.total,
          recommendation: 'Review entity definitions for this field type'
        });
      } else if (accuracy >= 0.9 && fieldStats.total >= 3) {
        patterns.accurateFields.push({
          fieldId,
          accuracy,
          attempts: fieldStats.total
        });
      }
    }

    return patterns;
  }

  /**
   * Suggest graph improvements based on feedback patterns
   * @returns {Promise<Array>} Array of improvement suggestions
   */
  static async suggestImprovements() {
    const patterns = await this.analyzePatterns();
    const suggestions = [];

    if (patterns.problematicFields.length > 0) {
      suggestions.push({
        type: 'low_accuracy_fields',
        priority: 'high',
        message: `${patterns.problematicFields.length} field(s) have low accuracy. Review entity linking.`,
        fields: patterns.problematicFields.map(f => f.fieldId)
      });
    }

    if (patterns.averageAccuracy < 0.6) {
      suggestions.push({
        type: 'overall_low_accuracy',
        priority: 'critical',
        message: 'Overall suggestion accuracy is below 60%. Consider adding more resume data or refining entity extraction.'
      });
    }

    return suggestions;
  }
}
