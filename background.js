import { GraphStorage } from './lib/graphStorage.js';
import { SemanticMatcher } from './lib/semanticMatcher.js';
import { NarrativeGenerator } from './lib/narrativeGenerator.js';
import { EntityExtractor } from './lib/entityExtraction.js';
import { FeedbackManager } from './lib/feedbackManager.js';
import { GraphLearning } from './lib/graphLearning.js';
import { LLMManager } from './lib/llmManager.js';

// Initialize graph storage on service worker startup
GraphStorage.init().catch(err => console.error('Failed to initialize GraphStorage:', err));

/**
 * Handle autofill requests from content script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AUTOFILL_REQUEST') {
    handleAutofillRequest(request, sender).then(sendResponse).catch(err => {
      console.error('Autofill request error:', err);
      sendResponse({ error: err.message });
    });
    return true;  // Indicate we will respond asynchronously
  }

  if (request.type === 'PROCESS_RESUME') {
    handleResumeUpload(request, sender).then(sendResponse).catch(err => {
      console.error('Resume upload error:', err);
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (request.type === 'RECORD_FEEDBACK') {
    handleFeedback(request, sender).then(sendResponse).catch(err => {
      console.error('Feedback recording error:', err);
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (request.type === 'GET_GRAPH_CONTEXT') {
    handleGetContext(request, sender).then(sendResponse).catch(err => {
      console.error('Get context error:', err);
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (request.type === 'ENHANCE_NARRATIVE') {
    handleNarrativeEnhancement(request, sender).then(sendResponse).catch(err => {
      console.error('Narrative enhancement error:', err);
      sendResponse({ enhanced: request.data.narrative });  // Fallback to original
    });
    return true;
  }
});

/**
 * Main autofill handler: analyze form and generate suggestions
 */
async function handleAutofillRequest(request, sender) {
  const formFields = request.data || [];

  if (formFields.length === 0) {
    return { suggestions: [] };
  }

  const suggestions = [];

  for (const field of formFields) {
    try {
      // Analyze field and find matching entities
      const suggestion = await SemanticMatcher.suggestForField(field);

      // For text/simple fields, suggestion.suggestion is already set
      if (suggestion.suggestion) {
        suggestions.push({
          fieldId: field.id,
          value: suggestion.suggestion,
          confidence: suggestion.confidence
        });
      }
      // For narrative fields, generate narrative from matched entity
      else if (suggestion.sourceNode && field.type === 'textarea') {
        const narrative = await NarrativeGenerator.generateNarrative(
          field.label,
          suggestion.sourceNode.id,
          150
        );

        if (narrative) {
          suggestions.push({
            fieldId: field.id,
            value: narrative,
            confidence: suggestion.confidence,
            isGenerated: true
          });
        }
      }
    } catch (error) {
      console.error(`Error processing field ${field.id}:`, error);
    }
  }

  return { suggestions, timestamp: Date.now() };
}

/**
 * Handle resume file upload and entity extraction
 */
async function handleResumeUpload(request, sender) {
  const file = request.data;

  if (!file) {
    throw new Error('No file provided');
  }

  // Process resume and populate graph
  const result = await EntityExtractor.processResume(new File([file], 'resume.pdf'));

  // Infer additional relationships
  const inferredResult = await EntityExtractor.inferRelationships();

  return {
    success: true,
    entities: result.entities,
    nodesCreated: result.nodesCreated,
    edgesCreated: result.edgesCreated,
    inferred: inferredResult.inferred
  };
}

/**
 * Handle user feedback on autofill suggestions
 */
async function handleFeedback(request, sender) {
  const feedback = request.data;

  // Record the feedback
  const record = await FeedbackManager.recordFeedback({
    formUrl: sender.url,
    ...feedback
  });

  // Process feedback to update graph
  const updates = await GraphLearning.processFeedback(record.id);

  return {
    success: true,
    feedbackId: record.id,
    updates
  };
}

/**
 * Return current graph context for analysis
 */
async function handleGetContext(request, sender) {
  const context = await GraphStorage.getFullContext();

  return {
    nodes: context.nodes.length,
    edges: context.edges.length,
    timestamp: context.timestamp
  };
}

/**
 * Enhance a narrative using LLM if available
 */
async function handleNarrativeEnhancement(request, sender) {
  const { narrative, prompt } = request.data;

  try {
    if (!LLMManager.isAvailable()) {
      return { enhanced: narrative };  // Return original if LLM unavailable
    }

    await LLMManager.initialize();
    const enhanced = await LLMManager.enhanceNarrative(narrative, prompt);
    return { enhanced };
  } catch (error) {
    console.error('LLM enhancement failed:', error);
    return { enhanced: narrative };  // Fallback to original
  }
}