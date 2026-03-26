/**
 * Response Cache Constants
 * 
 * Configuration for the enterprise-grade semantic response caching system.
 * Optimizes agent response times and reduces LLM costs through intelligent caching.
 * 
 * Architecture:
 *   L1: In-Memory LRU Cache (exact hash match) → ~30-80ms
 *   L2: PostgreSQL Semantic Cache (vector similarity) → ~100-200ms
 * 
 * Cache hit saves: 2-5 seconds + LLM API cost per query
 */

/**
 * L1 In-Memory Cache Configuration
 * Fast exact-match cache for repeated identical queries
 */
const L1_CACHE_CONFIG = {
  // Maximum number of entries in LRU cache per project
  MAX_ENTRIES: 500,
  
  // Time-to-live for L1 cache entries (in milliseconds)
  TTL_MS: 5 * 60 * 1000, // 5 minutes
  
  // Minimum query length to cache (skip very short queries)
  MIN_QUERY_LENGTH: 10,
};

/**
 * L2 PostgreSQL Semantic Cache Configuration
 * Persistent cache with vector similarity matching
 */
const L2_CACHE_CONFIG = {
  // Minimum cosine similarity score to consider a cache hit
  // Higher = stricter matching (fewer false positives)
  // 0.92 provides excellent precision while catching rephrased queries
  SIMILARITY_THRESHOLD: 0.92,
  
  // Fallback threshold for high-confidence partial matches
  // Used when combined with other matching signals
  PARTIAL_SIMILARITY_THRESHOLD: 0.88,
  
  // Default TTL for cached responses (in hours)
  DEFAULT_TTL_HOURS: 48,
  
  // TTL by intent type (some responses are more volatile)
  TTL_BY_INTENT: {
    read: 72,           // Explanations/documentation - longer TTL
    write: 24,          // Code changes - shorter TTL
    implementation: 12, // Active implementation - shortest TTL
    general: 48,        // Default questions
    docgen: 48,         // Document generation
  },
  
  // Maximum cached responses per project (prevents unbounded growth)
  MAX_ENTRIES_PER_PROJECT: 10000,
  
  // Number of candidates to retrieve for similarity search
  SIMILARITY_SEARCH_TOP_K: 5,
};

/**
 * Cache Key Generation Configuration
 */
const CACHE_KEY_CONFIG = {
  // Include these factors in cache key hash
  HASH_FACTORS: ['query', 'agentType', 'intent'],
  
  // Normalize queries before hashing (improves hit rate)
  NORMALIZE_QUERY: true,
  
  // Hash algorithm for cache keys
  HASH_ALGORITHM: 'sha256',
};

/**
 * Cache Invalidation Configuration
 */
const INVALIDATION_CONFIG = {
  // Automatically invalidate cache when KB version changes
  INVALIDATE_ON_KB_UPDATE: true,
  
  // Grace period after KB update before cache is invalidated (seconds)
  // Allows ongoing requests to complete
  INVALIDATION_GRACE_PERIOD_SEC: 30,
  
  // Events that trigger cache invalidation
  INVALIDATION_TRIGGERS: [
    'document_added',
    'document_deleted',
    'document_updated',
    'codebase_synced',
    'manual_flush',
  ],
};

/**
 * Cache Analytics & Monitoring
 */
const ANALYTICS_CONFIG = {
  // Track hit/miss statistics
  TRACK_STATS: true,
  
  // Log cache operations at this level
  LOG_LEVEL: 'info', // 'debug' | 'info' | 'warn' | 'error' | 'none'
  
  // Sample rate for detailed logging (0.0 - 1.0)
  DETAILED_LOG_SAMPLE_RATE: 0.1,
};

/**
 * Queries/intents that should NOT be cached
 * These require real-time or dynamic responses
 */
const NON_CACHEABLE_PATTERNS = [
  // Time-sensitive queries
  /\b(now|current|today|latest|recent)\b/i,
  
  // User-specific queries
  /\b(my|mine|i have|i am)\b/i,
  
  // Dynamic data queries
  /\b(status|progress|running|active)\b/i,
  
  // Explicit freshness requests
  /\b(refresh|reload|update|new)\b/i,
];

/**
 * Agent types that support caching
 * Some agent types may have side effects that make caching inappropriate
 */
const CACHEABLE_AGENT_TYPES = ['dev', 'PM', 'general'];

/**
 * Intents that support caching
 */
const CACHEABLE_INTENTS = ['read', 'write', 'general', 'docgen'];

/**
 * Response quality checks before caching
 */
const RESPONSE_QUALITY_CONFIG = {
  // Minimum response length to cache (skip empty/error responses)
  MIN_RESPONSE_LENGTH: 50,
  
  // Patterns that indicate error responses (don't cache these)
  ERROR_PATTERNS: [
    /error|exception|failed|unable to/i,
    /sorry.*can't|cannot process/i,
    /no response generated/i,
  ],
  
  // Maximum response length to cache (prevent bloat)
  MAX_RESPONSE_LENGTH: 50000,
};

/**
 * Get TTL in milliseconds for a given intent
 * @param {string} intent - Intent type
 * @returns {number} TTL in milliseconds
 */
const getTtlForIntent = (intent) => {
  const hours = L2_CACHE_CONFIG.TTL_BY_INTENT[intent] || L2_CACHE_CONFIG.DEFAULT_TTL_HOURS;
  return hours * 60 * 60 * 1000;
};

/**
 * Check if a query should be cached based on patterns
 * @param {string} query - User query
 * @returns {boolean} True if cacheable
 */
const isQueryCacheable = (query) => {
  if (!query || query.length < L1_CACHE_CONFIG.MIN_QUERY_LENGTH) {
    return false;
  }
  
  // Check against non-cacheable patterns
  for (const pattern of NON_CACHEABLE_PATTERNS) {
    if (pattern.test(query)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Check if a response should be cached based on quality
 * @param {string} response - Agent response
 * @returns {boolean} True if response is cache-worthy
 */
const isResponseCacheable = (response) => {
  if (!response) return false;
  
  const length = response.length;
  if (length < RESPONSE_QUALITY_CONFIG.MIN_RESPONSE_LENGTH) {
    return false;
  }
  
  if (length > RESPONSE_QUALITY_CONFIG.MAX_RESPONSE_LENGTH) {
    return false;
  }
  
  // Check for error patterns
  for (const pattern of RESPONSE_QUALITY_CONFIG.ERROR_PATTERNS) {
    if (pattern.test(response)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Check if agent type supports caching
 * @param {string} agentType - Agent type
 * @returns {boolean} True if cacheable
 */
const isAgentTypeCacheable = (agentType) => {
  return CACHEABLE_AGENT_TYPES.includes(agentType);
};

/**
 * Check if intent supports caching
 * @param {string} intent - Intent type
 * @returns {boolean} True if cacheable
 */
const isIntentCacheable = (intent) => {
  return CACHEABLE_INTENTS.includes(intent);
};

module.exports = {
  L1_CACHE_CONFIG,
  L2_CACHE_CONFIG,
  CACHE_KEY_CONFIG,
  INVALIDATION_CONFIG,
  ANALYTICS_CONFIG,
  NON_CACHEABLE_PATTERNS,
  CACHEABLE_AGENT_TYPES,
  CACHEABLE_INTENTS,
  RESPONSE_QUALITY_CONFIG,
  getTtlForIntent,
  isQueryCacheable,
  isResponseCacheable,
  isAgentTypeCacheable,
  isIntentCacheable,
};
