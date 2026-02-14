/**
 * FeedbackManager - Capture and store user feedback on autofill suggestions
 * Enables continuous learning and graph refinement
 */

import { GraphStorage } from './graphStorage.js';

export class FeedbackManager {
  static FEEDBACK_STORE_KEY = 'autofill_feedback_history';

  /**
   * Record user feedback on an autofill suggestion
   * @param {Object} feedback - Feedback object
   * @returns {Promise<Object>} Stored feedback with ID
   */
  static async recordFeedback(feedback) {
    const feedbackRecord = {
      id: `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      formUrl: feedback.formUrl || '',
      fieldId: feedback.fieldId || '',
      originalSuggestion: feedback.originalSuggestion || '',
      userEdit: feedback.userEdit || '',
      sourceNodeId: feedback.sourceNodeId || '',
      feedback: feedback.feedback || 'ignored',  // 'correct', 'partially_correct', 'incorrect', 'ignored'
      timestamp: Date.now(),
      affectedNodeIds: feedback.affectedNodeIds || [],
      notes: feedback.notes || ''
    };

    // Save to chrome storage
    const history = await this._getFeedbackHistory();
    history.push(feedbackRecord);
    
    await chrome.storage.local.set({
      [this.FEEDBACK_STORE_KEY]: history
    });

    return feedbackRecord;
  }

  /**
   * Get all feedback history
   * @returns {Promise<Array>} Array of feedback records
   */
  static async getFeedbackHistory() {
    return this._getFeedbackHistory();
  }

  /**
   * Get feedback for a specific source node
   * @param {string} nodeId - The source node ID
   * @returns {Promise<Array>} Feedback records related to this node
   */
  static async getFeedbackForNode(nodeId) {
    const history = await this._getFeedbackHistory();
    return history.filter(f => f.sourceNodeId === nodeId || f.affectedNodeIds?.includes(nodeId));
  }

  /**
   * Get feedback statistics
   * @returns {Promise<Object>} Feedback statistics
   */
  static async getStatistics() {
    const history = await this._getFeedbackHistory();

    const stats = {
      total: history.length,
      correct: 0,
      partiallyCorrect: 0,
      incorrect: 0,
      ignored: 0,
      averageEditDistance: 0,
      feedbackByField: {}
    };

    let totalEditDistance = 0;
    let editCount = 0;

    for (const record of history) {
      stats[record.feedback.replace(/-/g, '')] = (stats[record.feedback.replace(/-/g, '')] || 0) + 1;

      // Track edits
      if (record.userEdit !== record.originalSuggestion) {
        totalEditDistance += this._editDistance(record.originalSuggestion, record.userEdit);
        editCount++;
      }

      // Track by field
      if (!stats.feedbackByField[record.fieldId]) {
        stats.feedbackByField[record.fieldId] = { correct: 0, incorrect: 0, total: 0 };
      }
      stats.feedbackByField[record.fieldId].total++;
      if (record.feedback === 'correct') {
        stats.feedbackByField[record.fieldId].correct++;
      } else if (record.feedback === 'incorrect') {
        stats.feedbackByField[record.fieldId].incorrect++;
      }
    }

    if (editCount > 0) {
      stats.averageEditDistance = totalEditDistance / editCount;
    }

    return stats;
  }

  /**
   * Clear all feedback history
   */
  static async clearHistory() {
    await chrome.storage.local.set({
      [this.FEEDBACK_STORE_KEY]: []
    });
  }

  /**
   * Get feedback insights for improving entity confidence
   * @param {string} nodeId - Node to analyze
   * @returns {Promise<Object>} Insights about the node's accuracy
   */
  static async getNodeInsights(nodeId) {
    const feedback = await this.getFeedbackForNode(nodeId);

    if (feedback.length === 0) {
      return {
        nodeId,
        confidence: 0.5,  // Default middle confidence for untested nodes
        accuracy: null,
        totalUses: 0,
        correctUses: 0,
        recommendations: 'Needs more data to make recommendations'
      };
    }

    const correctCount = feedback.filter(f => f.feedback === 'correct').length;
    const partialCount = feedback.filter(f => f.feedback === 'partially_correct').length;
    const incorrectCount = feedback.filter(f => f.feedback === 'incorrect').length;

    // Calculate confidence based on feedback
    const totalRated = correctCount + partialCount + incorrectCount;
    const weightedScore = (correctCount + partialCount * 0.5) / Math.max(totalRated, 1);
    
    // Adjust confidence based on frequency of use
    const useFrequency = Math.min(feedback.length / 10, 1);  // Cap at 1.0 for 10+ uses
    const confidence = 0.5 + (weightedScore * 0.5) * useFrequency;

    const recommendations = [];
    if (incorrectCount > correctCount) {
      recommendations.push('Warning: More incorrect uses than correct. Consider reviewing entity definition.');
    }
    if (feedback.length < 3) {
      recommendations.push('Limited feedback data. Entity needs more usage to improve.');
    }
    if (correctCount === feedback.length) {
      recommendations.push('Excellent! This entity is consistently correct.');
    }

    return {
      nodeId,
      confidence: Math.min(confidence, 1.0),
      accuracy: correctCount / Math.max(totalRated, 1),
      totalUses: feedback.length,
      correctUses: correctCount,
      partialUses: partialCount,
      incorrectUses: incorrectCount,
      recommendations: recommendations.length > 0 ? recommendations : ['Performing as expected']
    };
  }

  /**
   * Internal: Get feedback history from storage
   * @private
   */
  static async _getFeedbackHistory() {
    const data = await chrome.storage.local.get(this.FEEDBACK_STORE_KEY);
    return data[this.FEEDBACK_STORE_KEY] || [];
  }

  /**
   * Calculate edit distance between two strings
   * @private
   */
  static _editDistance(s1, s2) {
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }
}
