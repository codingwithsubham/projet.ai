/**
 * RAG (Retrieval-Augmented Generation) Constants
 * 
 * Configuration for vector search, context building, and similarity thresholds.
 * Used by chat helpers and embedding services.
 */

/**
 * Maximum number of context chunks to retrieve from vector store
 */
const MAX_CONTEXT_CHUNKS = 6;

/**
 * Maximum character length for combined RAG context
 * Prevents context window overflow
 */
const MAX_CONTEXT_CHARS = 9000;

/**
 * Maximum number of previous conversations to include for context
 */
const MAX_PREVIOUS_CONVERSATIONS = 3;

/**
 * Intent types for RAG queries
 * Determines similarity threshold and retrieval strategy
 */
const RAG_INTENTS = {
  READ: "read",
  WRITE: "write",
  IMPLEMENTATION: "implementation",
  GENERAL: "general",
};

/**
 * Intent-aware similarity thresholds for vector search
 * Higher thresholds = more precise matches (stricter filtering)
 * Lower thresholds = broader context (more inclusive)
 */
const SIMILARITY_THRESHOLDS = {
  [RAG_INTENTS.READ]: 0.4,           // Broader context for understanding/explanations
  [RAG_INTENTS.WRITE]: 0.55,         // Precise context for code changes
  [RAG_INTENTS.IMPLEMENTATION]: 0.6, // Highest precision for new implementations
  [RAG_INTENTS.GENERAL]: 0.5,        // Balanced default threshold
};

/**
 * Intent-aware context chunk counts
 * More chunks for complex tasks, fewer for focused queries
 */
const CONTEXT_CHUNKS_BY_INTENT = {
  [RAG_INTENTS.READ]: 4,             // Focused context for explanations
  [RAG_INTENTS.WRITE]: 8,            // More context for code changes
  [RAG_INTENTS.IMPLEMENTATION]: 10,  // Maximum context for complex implementations
  [RAG_INTENTS.GENERAL]: 6,          // Balanced default
};

/**
 * Default similarity threshold when intent is unknown
 */
const DEFAULT_SIMILARITY_THRESHOLD = SIMILARITY_THRESHOLDS[RAG_INTENTS.GENERAL];

/**
 * Default chunk count when intent is unknown
 */
const DEFAULT_CONTEXT_CHUNKS = CONTEXT_CHUNKS_BY_INTENT[RAG_INTENTS.GENERAL];

/**
 * Get similarity threshold for a given intent
 * @param {string} intent - One of RAG_INTENTS values
 * @returns {number} Similarity threshold
 */
const getThresholdForIntent = (intent) => {
  return SIMILARITY_THRESHOLDS[intent] || DEFAULT_SIMILARITY_THRESHOLD;
};

/**
 * Get context chunk count for a given intent
 * @param {string} intent - One of RAG_INTENTS values
 * @returns {number} Number of chunks to retrieve
 */
const getChunksForIntent = (intent) => {
  return CONTEXT_CHUNKS_BY_INTENT[intent] || DEFAULT_CONTEXT_CHUNKS;
};

module.exports = {
  MAX_CONTEXT_CHUNKS,
  MAX_CONTEXT_CHARS,
  MAX_PREVIOUS_CONVERSATIONS,
  RAG_INTENTS,
  SIMILARITY_THRESHOLDS,
  CONTEXT_CHUNKS_BY_INTENT,
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_CONTEXT_CHUNKS,
  getThresholdForIntent,
  getChunksForIntent,
};
