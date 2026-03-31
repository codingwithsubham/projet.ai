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
const MAX_CONTEXT_CHARS = 6000;

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
  DOCGEN: "docgen", // Document/presentation generation from code
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
  [RAG_INTENTS.DOCGEN]: 0.3,         // Very inclusive for doc generation from code
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
  [RAG_INTENTS.DOCGEN]: 10,          // Maximum context for document generation
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

/**
 * Retrieval modes for search strategy selection
 * Allows intent-based routing to different search algorithms
 */
const RETRIEVAL_MODES = {
  SEMANTIC: "semantic",   // Dense vector search only (current default)
  HYBRID: "hybrid",       // Semantic + BM25 keyword search with RRF fusion
  KEYWORD: "keyword",     // BM25 keyword search only
};

/**
 * Hybrid search configuration
 * Tunable parameters for balancing semantic vs keyword search
 */
const HYBRID_CONFIG = {
  alpha: 0.7,              // Weight for semantic results (1-alpha for keyword)
  rrfK: 60,                // RRF constant (standard value, higher = more weight to lower ranks)
  keywordBoostThreshold: 3, // Boost keyword weight if query has ≤N words
  keywordBoostAlpha: 0.5,   // Alpha to use when keyword boost is active
};

/**
 * Intent → Retrieval mode mapping
 * Determines which search strategy to use based on user intent
 */
const RETRIEVAL_MODE_BY_INTENT = {
  [RAG_INTENTS.READ]: RETRIEVAL_MODES.SEMANTIC,           // Semantic for explanations
  [RAG_INTENTS.WRITE]: RETRIEVAL_MODES.HYBRID,            // Hybrid for code changes
  [RAG_INTENTS.IMPLEMENTATION]: RETRIEVAL_MODES.HYBRID,   // Hybrid for implementations
  [RAG_INTENTS.GENERAL]: RETRIEVAL_MODES.SEMANTIC,        // Semantic for general queries
  [RAG_INTENTS.DOCGEN]: RETRIEVAL_MODES.HYBRID,           // Hybrid for document generation
};

/**
 * Get retrieval mode for a given intent
 * @param {string} intent - One of RAG_INTENTS values
 * @returns {string} Retrieval mode
 */
const getRetrievalModeForIntent = (intent) => {
  return RETRIEVAL_MODE_BY_INTENT[intent] || RETRIEVAL_MODES.SEMANTIC;
};

/**
 * Calculate effective alpha based on query characteristics
 * Short queries (likely specific terms) get boosted keyword weight
 * @param {string} query - User query
 * @returns {number} Effective alpha for hybrid search
 */
const getEffectiveAlpha = (query) => {
  const wordCount = (query || "").trim().split(/\s+/).length;
  if (wordCount <= HYBRID_CONFIG.keywordBoostThreshold) {
    return HYBRID_CONFIG.keywordBoostAlpha;
  }
  return HYBRID_CONFIG.alpha;
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
  // Hybrid search exports
  RETRIEVAL_MODES,
  HYBRID_CONFIG,
  RETRIEVAL_MODE_BY_INTENT,
  getRetrievalModeForIntent,
  getEffectiveAlpha,
};
