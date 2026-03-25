/**
 * Hybrid Search Service
 * 
 * Enterprise-grade hybrid retrieval combining:
 * - Semantic: Dense vector search via LangChain PGVectorStore
 * - Keyword: PostgreSQL full-text search (BM25-like scoring)
 * - Fusion: Reciprocal Rank Fusion (RRF) algorithm
 * 
 * SCHEMA-PER-PROJECT ISOLATION:
 * Each project's data is stored in its own PostgreSQL schema (project_{id}).
 * Queries automatically target the correct schema - no cross-project data leaks.
 * 
 * Architecture:
 *   Query ──┬──► Semantic Search (LangChain) ──► Results A
 *           │                                        │
 *           └──► BM25 Search (PostgreSQL FTS) ──► Results B
 *                                                    │
 *                                              RRF Fusion
 *                                                    │
 *                                              Final Results
 */

const { getPool } = require("../config/pgvector");
const { buildFullTextSearchQuery, getProjectTableName } = require("../common/sql-queries");
const { HYBRID_CONFIG, getEffectiveAlpha } = require("../common/rag-constants");

/**
 * Perform full-text (BM25-like) search using PostgreSQL tsvector
 * Runs independently from semantic search for true hybrid retrieval
 * 
 * Uses schema-per-project isolation - queries target project_{id}.embeddings
 * 
 * @param {Object} options
 * @param {string} options.projectId - Project ID for schema isolation
 * @param {string} options.query - Search query
 * @param {number} options.topK - Number of results
 * @param {Object} [options.filter] - Metadata filter (repoId, repoTag)
 * @returns {Promise<Array<{content: string, metadata: object, score: number}>>}
 */
const fullTextSearch = async ({ projectId, query, topK = 10, filter = {} }) => {
  if (!query?.trim() || !projectId) return [];

  const pool = getPool();
  
  // Convert query to tsquery format (OR between words for broader matching)
  const searchTerms = query
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 1)
    .map(term => term.replace(/[^\w]/g, "")) // Remove special chars
    .filter(Boolean)
    .join(" | "); // OR operator for flexibility

  if (!searchTerms) return [];

  try {
    // Get project-specific table name (schema-isolated)
    const tableName = getProjectTableName(projectId);
    
    // Build parameterized query for schema mode
    const hasRepoId = Boolean(filter.repoId);
    const hasRepoTag = Boolean(filter.repoTag);
    
    const { query: sqlQuery, limitParam } = buildFullTextSearchQuery({
      tableName,
      useSchemaMode: true, // Use content column, no projectId filter
      hasRepoId,
      hasRepoTag,
      paramOffset: 2, // Start after search terms ($1)
    });

    // Build params array - no projectId needed (schema isolation)
    const params = [searchTerms];
    if (hasRepoId) params.push(filter.repoId);
    if (hasRepoTag) params.push(filter.repoTag);
    params.push(topK);

    const result = await pool.query(sqlQuery, params);

    return result.rows.map(row => ({
      content: row.content,
      metadata: row.metadata || {},
      score: parseFloat(row.score) || 0,
      source: "keyword",
    }));
  } catch (err) {
    console.error("❌ Full-text search error:", err.message);
    // Graceful degradation - return empty rather than failing entire search
    return [];
  }
};

/**
 * Reciprocal Rank Fusion (RRF) algorithm
 * Merges results from multiple retrieval systems with rank-based scoring
 * 
 * Formula: RRF(d) = Σ weight * (1 / (k + rank(d)))
 * where k is a constant (typically 60) and rank is 1-indexed
 * 
 * @param {Array} resultSets - Array of result arrays, each with {content, metadata, score}
 * @param {Object} options
 * @param {number} options.k - RRF constant (default: 60)
 * @param {Array<number>} options.weights - Weights for each result set
 * @param {number} options.topK - Final number of results to return
 * @returns {Array} Fused and re-ranked results
 */
const reciprocalRankFusion = (resultSets, { k = 60, weights = null, topK = 10 } = {}) => {
  if (!resultSets?.length) return [];

  // Default to equal weights if not provided
  const setWeights = weights || resultSets.map(() => 1);

  // Map to track fused scores by content hash
  const fusedScores = new Map();

  resultSets.forEach((results, setIndex) => {
    const weight = setWeights[setIndex] || 1;

    results.forEach((result, rank) => {
      // Use content as unique key (could use hash for large content)
      const key = result.content;
      const rrfScore = weight * (1 / (k + rank + 1)); // rank is 0-indexed, RRF uses 1-indexed

      if (fusedScores.has(key)) {
        const existing = fusedScores.get(key);
        existing.rrfScore += rrfScore;
        existing.sources.push(result.source || `set${setIndex}`);
        // Keep highest original score for reference
        existing.originalScore = Math.max(existing.originalScore, result.score || 0);
      } else {
        fusedScores.set(key, {
          content: result.content,
          metadata: result.metadata,
          rrfScore,
          originalScore: result.score || 0,
          sources: [result.source || `set${setIndex}`],
        });
      }
    });
  });

  // Sort by RRF score and return top K
  return Array.from(fusedScores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
    .map(item => ({
      content: item.content,
      metadata: item.metadata,
      score: item.rrfScore,
      originalScore: item.originalScore,
      sources: item.sources,
    }));
};

/**
 * Enterprise Hybrid Search
 * Combines semantic (vector) and keyword (BM25) search with RRF fusion
 * 
 * Both searches run in parallel for true hybrid retrieval capability.
 * This ensures keyword-only matches are not missed by semantic search.
 * 
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {string} options.query - Search query
 * @param {number} options.topK - Number of results
 * @param {Object} [options.filter] - Metadata filter
 * @param {number} [options.minScore] - Minimum score threshold
 * @param {Function} options.semanticSearchFn - Semantic search function
 * @returns {Promise<Array>} Fused search results
 */
const hybridSearch = async ({
  project,
  query,
  topK = 10,
  filter = {},
  minScore = 0,
  semanticSearchFn,
}) => {
  if (!query?.trim()) return [];

  const projectId = String(project?._id || "");
  
  // Calculate effective alpha based on query characteristics
  const alpha = getEffectiveAlpha(query);
  const keywordWeight = 1 - alpha;

  console.log(`🔀 Hybrid search: alpha=${alpha.toFixed(2)} (semantic=${alpha.toFixed(2)}, keyword=${keywordWeight.toFixed(2)})`);

  // Fetch more results than needed for better fusion quality
  const fetchK = Math.min(topK * 3, 30);

  try {
    // Run BOTH searches in parallel (true hybrid retrieval)
    const [semanticResults, keywordResults] = await Promise.all([
      semanticSearchFn({
        project,
        query,
        topK: fetchK,
        filter,
        minScore: 0, // Don't filter yet, let fusion handle it
      }),
      fullTextSearch({
        projectId,
        query,
        topK: fetchK,
        filter,
      }),
    ]);

    // Tag sources for debugging/analytics
    const taggedSemantic = semanticResults.map(r => ({ ...r, source: "semantic" }));
    const taggedKeyword = keywordResults.map(r => ({ ...r, source: "keyword" }));

    console.log(`📊 Semantic: ${taggedSemantic.length} results, Keyword: ${taggedKeyword.length} results`);

    // Handle edge cases
    if (taggedSemantic.length === 0 && taggedKeyword.length === 0) {
      console.log("⚠️ No results from either search");
      return [];
    }

    if (taggedKeyword.length === 0) {
      console.log("⚡ No keyword matches, using semantic only");
      return semanticResults
        .filter(r => r.score >= minScore)
        .slice(0, topK);
    }

    if (taggedSemantic.length === 0) {
      console.log("⚡ No semantic matches, using keyword only");
      return keywordResults.slice(0, topK);
    }

    // Fuse results with weighted RRF
    const fused = reciprocalRankFusion(
      [taggedSemantic, taggedKeyword],
      {
        k: HYBRID_CONFIG.rrfK,
        weights: [alpha, keywordWeight],
        topK,
      }
    );

    // Apply minimum score filter (using original semantic score)
    const filtered = minScore > 0 
      ? fused.filter(r => r.originalScore >= minScore)
      : fused;

    console.log(`✅ Hybrid search: ${filtered.length} fused results`);

    return filtered;
  } catch (err) {
    console.error("❌ Hybrid search error:", err.message);
    // Graceful degradation to semantic only
    console.log("⚡ Falling back to semantic search");
    return semanticSearchFn({ project, query, topK, filter, minScore });
  }
};

module.exports = {
  fullTextSearch,
  reciprocalRankFusion,
  hybridSearch,
};
