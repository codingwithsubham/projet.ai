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
 * Table Schema (legacy aidlc_embeddings):
 *   - id: uuid (primary key)
 *   - text: text (document content)
 *   - metadata: jsonb (projectId, repoId, repoTag, source, etc.)
 *   - embedding: vector (1536 dimensions)
 * 
 * Table Schema (project-specific schema.embeddings):
 *   - id: uuid (primary key)
 *   - content: text (document content)
 *   - metadata: jsonb (repoId, repoTag, source, etc.)
 *   - embedding: vector (1536 dimensions)
 */

// Legacy table name - for backward compatibility
const TABLE_NAME = "aidlc_embeddings";

// Schema-per-project settings
const SCHEMA_PREFIX = "project_";
const EMBEDDINGS_TABLE = "embeddings";

/**
 * Get the table name for a project (schema-isolated)
 * @param {string} projectId - Project ID
 * @returns {string} Fully qualified table name
 */
const getProjectTableName = (projectId) => {
  if (!projectId) return TABLE_NAME; // Fallback to legacy
  const sanitized = String(projectId).toLowerCase().replace(/[^a-f0-9]/g, "");
  return `"${SCHEMA_PREFIX}${sanitized}"."${EMBEDDINGS_TABLE}"`;
};

/**
 * Build Full-Text Search (BM25-like) Query
 * 
 * Uses PostgreSQL's built-in full-text search with ts_rank_cd scoring.
 * ts_rank_cd provides better ranking for document retrieval than ts_rank.
 * 
 * Supports both:
 * - Legacy mode: shared table with projectId filter (uses 'text' column)
 * - Schema mode: project-specific schema (uses 'content' column)
 * 
 * @param {Object} options
 * @param {string} [options.tableName] - Full table reference (schema.table or table)
 * @param {boolean} [options.useSchemaMode=false] - Use schema-per-project mode
 * @param {boolean} options.hasRepoId - Include repoId filter
 * @param {boolean} options.hasRepoTag - Include repoTag filter
 * @param {number} options.paramOffset - Starting parameter index for filters
 * @returns {Object} { query: string, limitParam: number, paramOffset: number }
 */
const buildFullTextSearchQuery = ({ 
  tableName = TABLE_NAME,
  useSchemaMode = false,
  hasRepoId = false, 
  hasRepoTag = false, 
  paramOffset = 2 
} = {}) => {
  // In schema mode: content column, no projectId filter (schema IS the isolation)
  // In legacy mode: text column, projectId filter required
  const contentColumn = useSchemaMode ? "content" : "text";
  
  // Build base query
  let query = `
  SELECT 
    ${contentColumn} as content,
    metadata,
    ts_rank_cd(
      to_tsvector('english', ${contentColumn}), 
      to_tsquery('english', $1)
    ) as score
  FROM ${tableName}
  WHERE to_tsvector('english', ${contentColumn}) @@ to_tsquery('english', $1)`;
  
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
    // Expose for callers that need to know param positions
    paramOffset: currentParam,
  };
};

/**
 * Migration query to add full-text search index (legacy shared table)
 * Run this once to optimize full-text search performance
 * 
 * Note: This is idempotent (IF NOT EXISTS)
 * Note: For schema-per-project, indexes are created by schemaManager.service.js
 */
const CREATE_FTS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_embeddings_fts 
  ON "${TABLE_NAME}" 
  USING GIN(to_tsvector('english', text));
`;

/**
 * Check if FTS index exists (legacy shared table)
 */
const CHECK_FTS_INDEX = `
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = '${TABLE_NAME}' 
    AND indexname = 'idx_embeddings_fts'
  ) as exists;
`;

/**
 * Ensure FTS index exists for legacy shared table
 * (call once at startup or during migration)
 * 
 * Note: For schema-per-project mode, indexes are managed by schemaManager.service.js
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<{created: boolean, existed: boolean}>}
 */
const ensureFtsIndex = async (pool) => {
  try {
    // Check if legacy table exists first
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      ) as exists
    `, [TABLE_NAME]);
    
    if (!tableCheck.rows[0]?.exists) {
      console.log("⚠️ Legacy embeddings table does not exist, skipping FTS index");
      return { created: false, existed: false };
    }
    
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
  SCHEMA_PREFIX,
  EMBEDDINGS_TABLE,
  getProjectTableName,
  buildFullTextSearchQuery,
  CREATE_FTS_INDEX,
  CHECK_FTS_INDEX,
  ensureFtsIndex,
};
