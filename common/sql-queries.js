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

// ============================================================================
// SCHEMA MANAGER QUERIES
// ============================================================================

/**
 * Vector dimension for embeddings (OpenAI text-embedding-3-large)
 */
const VECTOR_DIMENSION = 1536;

/**
 * Sanitize project ID for PostgreSQL identifier
 * @param {string} projectId - MongoDB ObjectId
 * @returns {string} Sanitized ID (24 hex chars)
 */
const sanitizeProjectId = (projectId) => {
  if (!projectId) throw new Error("Project ID is required");
  const sanitized = String(projectId).toLowerCase().replace(/[^a-f0-9]/g, "");
  if (sanitized.length !== 24) {
    throw new Error(`Invalid project ID format: ${projectId}`);
  }
  return sanitized;
};

/**
 * Get schema name for a project
 * @param {string} projectId - Project ID
 * @returns {string} Schema name (project_{id})
 */
const getSchemaName = (projectId) => {
  return `${SCHEMA_PREFIX}${sanitizeProjectId(projectId)}`;
};

/**
 * Get fully qualified embeddings table name
 * @param {string} projectId - Project ID
 * @returns {string} schema.table format
 */
const getEmbeddingsTableName = (projectId) => {
  return `${getSchemaName(projectId)}.${EMBEDDINGS_TABLE}`;
};

// --- Schema Existence Checks ---

const SCHEMA_QUERIES = {
  /** Check if schema exists */
  CHECK_SCHEMA_EXISTS: `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata 
      WHERE schema_name = $1
    ) as exists
  `,

  /** Check if table exists in schema */
  CHECK_TABLE_EXISTS: `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name = $2
    ) as exists
  `,

  /** List all project schemas */
  LIST_PROJECT_SCHEMAS: `
    SELECT schema_name FROM information_schema.schemata 
    WHERE schema_name LIKE $1
    ORDER BY schema_name
  `,

  /** Get project statistics */
  GET_PROJECT_STATS: (schemaName) => `
    SELECT COUNT(*) as count FROM "${schemaName}"."${EMBEDDINGS_TABLE}"
  `,

  /** Get schema size */
  GET_SCHEMA_SIZE: `
    SELECT pg_size_pretty(
      COALESCE(
        (SELECT SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))
         FROM pg_tables WHERE schemaname = $1),
        0
      )
    ) as size
  `,
};

// --- Schema Creation DDL ---

/**
 * Build DDL statements for creating project schema and tables
 * @param {string} schemaName - Schema name
 * @returns {Object} DDL statements
 */
const buildSchemaDDL = (schemaName) => ({
  /** Enable pgvector extension */
  CREATE_EXTENSION: `CREATE EXTENSION IF NOT EXISTS vector`,

  /** Create project schema */
  CREATE_SCHEMA: `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,

  /** Create embeddings table */
  CREATE_EMBEDDINGS_TABLE: `
    CREATE TABLE IF NOT EXISTS "${schemaName}"."${EMBEDDINGS_TABLE}" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding vector(${VECTOR_DIMENSION}),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `,

  /** Create vector similarity index (IVFFlat) */
  CREATE_VECTOR_INDEX: `
    CREATE INDEX IF NOT EXISTS "${schemaName}_embeddings_vector_idx"
    ON "${schemaName}"."${EMBEDDINGS_TABLE}" 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  `,

  /** Create full-text search index */
  CREATE_FTS_INDEX: `
    CREATE INDEX IF NOT EXISTS "${schemaName}_embeddings_fts_idx"
    ON "${schemaName}"."${EMBEDDINGS_TABLE}" 
    USING GIN(to_tsvector('english', content))
  `,

  /** Create metadata index */
  CREATE_METADATA_INDEX: `
    CREATE INDEX IF NOT EXISTS "${schemaName}_embeddings_metadata_idx"
    ON "${schemaName}"."${EMBEDDINGS_TABLE}" 
    USING GIN(metadata jsonb_path_ops)
  `,

  /** Drop schema cascade */
  DROP_SCHEMA: `DROP SCHEMA "${schemaName}" CASCADE`,
});

// --- Response Cache DDL ---

/**
 * Build DDL statements for response cache table
 * @param {string} schemaName - Schema name
 * @returns {Object} DDL statements
 */
const buildCacheDDL = (schemaName) => ({
  /** Create response cache table */
  CREATE_CACHE_TABLE: `
    CREATE TABLE IF NOT EXISTS "${schemaName}"."response_cache" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      query_hash VARCHAR(64) NOT NULL,
      query_text TEXT NOT NULL,
      query_embedding vector(${VECTOR_DIMENSION}) NOT NULL,
      agent_type VARCHAR(20) NOT NULL,
      intent VARCHAR(30) NOT NULL,
      response TEXT NOT NULL,
      rag_context_hash VARCHAR(64),
      kb_version INTEGER DEFAULT 1,
      hit_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      
      CONSTRAINT "${schemaName}_cache_unique_query" 
        UNIQUE (query_hash, agent_type, intent)
    )
  `,

  /** L1-style exact match index */
  CREATE_CACHE_EXACT_INDEX: `
    CREATE INDEX IF NOT EXISTS "${schemaName}_cache_exact_idx"
    ON "${schemaName}"."response_cache" (query_hash, agent_type, intent)
  `,

  /** L2 semantic similarity index */
  CREATE_CACHE_SEMANTIC_INDEX: `
    CREATE INDEX IF NOT EXISTS "${schemaName}_cache_semantic_idx"
    ON "${schemaName}"."response_cache" 
    USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100)
  `,

  /** TTL cleanup index */
  CREATE_CACHE_EXPIRY_INDEX: `
    CREATE INDEX IF NOT EXISTS "${schemaName}_cache_expiry_idx"
    ON "${schemaName}"."response_cache" (expires_at)
  `,

  /** KB version index for invalidation */
  CREATE_CACHE_KB_VERSION_INDEX: `
    CREATE INDEX IF NOT EXISTS "${schemaName}_cache_kb_version_idx"
    ON "${schemaName}"."response_cache" (kb_version)
  `,
});

// --- Migration Queries ---

const MIGRATION_QUERIES = {
  /** Check if source table exists */
  CHECK_SOURCE_TABLE: `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    ) as exists
  `,

  /** Count records in target table */
  COUNT_TARGET_RECORDS: (schemaName) => `
    SELECT COUNT(*) as count FROM "${schemaName}"."${EMBEDDINGS_TABLE}"
  `,

  /** Migrate data from legacy table to project schema */
  MIGRATE_DATA: (schemaName, sourceTable) => `
    INSERT INTO "${schemaName}"."${EMBEDDINGS_TABLE}" (content, metadata, embedding, created_at)
    SELECT 
      text as content,
      metadata,
      embedding,
      COALESCE(created_at, NOW())
    FROM "${sourceTable}"
    WHERE metadata->>'projectId' = $1
  `,
};

// ============================================================================
// RESPONSE CACHE QUERIES
// ============================================================================

/**
 * Get the cache table name for a project (schema-isolated)
 * @param {string} projectId - Project ID
 * @returns {string} Fully qualified table name
 */
const getCacheTableName = (projectId) => {
  if (!projectId) throw new Error("projectId required for cache table");
  const sanitized = String(projectId).toLowerCase().replace(/[^a-f0-9]/g, "");
  return `"${SCHEMA_PREFIX}${sanitized}"."response_cache"`;
};

/**
 * Build query for exact cache lookup (L1-style in L2)
 * @param {string} tableName - Full table name
 * @returns {string} SQL query
 */
const buildCacheExactLookupQuery = (tableName) => `
  SELECT response, query_text, hit_count
  FROM ${tableName}
  WHERE query_hash = $1
    AND agent_type = $2
    AND intent = $3
    AND expires_at > NOW()
    AND kb_version = (SELECT COALESCE(MAX(kb_version), 1) FROM ${tableName})
  LIMIT 1
`;

/**
 * Build query for semantic cache lookup (L2)
 * @param {string} tableName - Full table name
 * @returns {string} SQL query
 */
const buildCacheSemanticLookupQuery = (tableName) => `
  SELECT 
    response,
    query_text,
    1 - (query_embedding <=> $1::vector) as similarity
  FROM ${tableName}
  WHERE agent_type = $2
    AND intent = $3
    AND expires_at > NOW()
    AND kb_version = (SELECT COALESCE(MAX(kb_version), 1) FROM ${tableName})
    AND 1 - (query_embedding <=> $1::vector) >= $4
  ORDER BY query_embedding <=> $1::vector
  LIMIT 1
`;

/**
 * Build query to store/update cache entry
 * @param {string} tableName - Full table name
 * @returns {string} SQL query
 */
const buildCacheUpsertQuery = (tableName) => `
  INSERT INTO ${tableName} (
    query_hash, query_text, query_embedding, agent_type, intent,
    response, rag_context_hash, kb_version, expires_at
  ) VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8, $9)
  ON CONFLICT (query_hash, agent_type, intent) 
  DO UPDATE SET
    response = EXCLUDED.response,
    query_embedding = EXCLUDED.query_embedding,
    rag_context_hash = EXCLUDED.rag_context_hash,
    kb_version = EXCLUDED.kb_version,
    expires_at = EXCLUDED.expires_at,
    hit_count = 0,
    updated_at = NOW()
`;

/**
 * Build query to increment cache hit count
 * @param {string} tableName - Full table name
 * @returns {string} SQL query
 */
const buildCacheHitIncrementQuery = (tableName) => `
  UPDATE ${tableName} SET hit_count = hit_count + 1 WHERE query_hash = $1
`;

/**
 * Build query to get cache statistics
 * @param {string} tableName - Full table name
 * @returns {string} SQL query
 */
const buildCacheStatsQuery = (tableName) => `
  SELECT 
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
    COALESCE(SUM(hit_count), 0) as total_hits,
    COALESCE(AVG(hit_count), 0) as avg_hits_per_entry,
    MAX(kb_version) as current_kb_version
  FROM ${tableName}
`;

module.exports = {
  // Legacy constants
  TABLE_NAME,
  SCHEMA_PREFIX,
  EMBEDDINGS_TABLE,
  VECTOR_DIMENSION,
  
  // Table name helpers
  getProjectTableName,
  getCacheTableName,
  getSchemaName,
  getEmbeddingsTableName,
  sanitizeProjectId,
  
  // Full-text search
  buildFullTextSearchQuery,
  CREATE_FTS_INDEX,
  CHECK_FTS_INDEX,
  ensureFtsIndex,
  
  // Schema management
  SCHEMA_QUERIES,
  buildSchemaDDL,
  buildCacheDDL,
  MIGRATION_QUERIES,
  
  // Response cache queries
  buildCacheExactLookupQuery,
  buildCacheSemanticLookupQuery,
  buildCacheUpsertQuery,
  buildCacheHitIncrementQuery,
  buildCacheStatsQuery,
};
