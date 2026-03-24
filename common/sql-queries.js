/**
 * SQL Queries Constants
 * 
 * Centralized repository for all raw SQL queries used in the application.
 * This file serves as a single source of truth for database queries,
 * making them easier to audit, maintain, and optimize.
 * 
 * ⚠️  WARNING: Do not modify these queries without thorough testing.
 *     Changes may impact search quality and application performance.
 * 
 * Table Schema (aidlc_embeddings):
 *   - id: uuid (primary key)
 *   - text: text (document content)
 *   - metadata: jsonb (projectId, repoId, repoTag, source, etc.)
 *   - embedding: vector (1536 dimensions)
 */

// Table name - must match LangChain PGVectorStore configuration
const TABLE_NAME = "aidlc_embeddings";

/**
 * Full-Text Search (BM25-like) Query
 * 
 * Uses PostgreSQL's built-in full-text search with ts_rank_cd scoring.
 * ts_rank_cd provides better ranking for document retrieval than ts_rank.
 * 
 * Placeholders:
 *   $1 - projectId (string)
 *   $2 - search terms in tsquery format (e.g., "word1 | word2 | word3")
 *   $3 - topK limit (integer)
 * 
 * Optional filter placeholders are added dynamically:
 *   - repoId filter
 *   - repoTag filter
 * 
 * Performance Note: For large datasets, ensure GIN index exists:
 *   CREATE INDEX IF NOT EXISTS idx_embeddings_fts 
 *   ON aidlc_embeddings USING GIN(to_tsvector('english', text));
 */
const FULL_TEXT_SEARCH_BASE = `
  SELECT 
    text as content,
    metadata,
    ts_rank_cd(
      to_tsvector('english', text), 
      to_tsquery('english', $2)
    ) as score
  FROM "${TABLE_NAME}"
  WHERE metadata->>'projectId' = $1
    AND to_tsvector('english', text) @@ to_tsquery('english', $2)
`;

/**
 * Build the complete full-text search query with optional filters
 * 
 * @param {Object} options
 * @param {boolean} options.hasRepoId - Include repoId filter
 * @param {boolean} options.hasRepoTag - Include repoTag filter
 * @param {number} options.paramOffset - Starting parameter index for filters
 * @returns {Object} { query: string, limitParam: number }
 */
const buildFullTextSearchQuery = ({ hasRepoId = false, hasRepoTag = false, paramOffset = 3 } = {}) => {
  let query = FULL_TEXT_SEARCH_BASE;
  let currentParam = paramOffset;

  if (hasRepoId) {
    query += `\n    AND metadata->>'repoId' = $${currentParam}`;
    currentParam++;
  }

  if (hasRepoTag) {
    query += `\n    AND metadata->>'repoTag' = $${currentParam}`;
    currentParam++;
  }

  query += `\n  ORDER BY score DESC\n  LIMIT $${currentParam}`;

  return {
    query,
    limitParam: currentParam,
  };
};

/**
 * Migration query to add full-text search index
 * Run this once to optimize full-text search performance
 * 
 * Note: This is idempotent (IF NOT EXISTS)
 */
const CREATE_FTS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_embeddings_fts 
  ON "${TABLE_NAME}" 
  USING GIN(to_tsvector('english', text));
`;

/**
 * Check if FTS index exists
 */
const CHECK_FTS_INDEX = `
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = '${TABLE_NAME}' 
    AND indexname = 'idx_embeddings_fts'
  ) as exists;
`;

/**
 * Ensure FTS index exists (call once at startup or during migration)
 * This function should be called with a database pool
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<{created: boolean, existed: boolean}>}
 */
const ensureFtsIndex = async (pool) => {
  try {
    // Check if index exists
    const checkResult = await pool.query(CHECK_FTS_INDEX);
    const exists = checkResult.rows[0]?.exists || false;

    if (exists) {
      console.log("✅ FTS index already exists");
      return { created: false, existed: true };
    }

    // Create the index
    console.log("📝 Creating FTS index...");
    await pool.query(CREATE_FTS_INDEX);
    console.log("✅ FTS index created successfully");
    return { created: true, existed: false };
  } catch (err) {
    console.error("❌ Failed to ensure FTS index:", err.message);
    throw err;
  }
};

module.exports = {
  TABLE_NAME,
  FULL_TEXT_SEARCH_BASE,
  buildFullTextSearchQuery,
  CREATE_FTS_INDEX,
  CHECK_FTS_INDEX,
  ensureFtsIndex,
};
