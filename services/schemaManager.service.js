/**
 * Schema Manager Service
 * 
 * Manages PostgreSQL schemas for project-level data isolation.
 * Each project gets its own schema: project_{projectId}
 * 
 * Security Benefits:
 * - Database-level isolation (queries cannot accidentally access other projects)
 * - Per-project backup/restore capability
 * - Independent scaling and maintenance
 * - Future: Per-project encryption keys
 * 
 * Schema Structure:
 *   project_{projectId}/
 *     └── embeddings (vector table with same structure as original)
 */

const { getPool, VECTOR_DIMENSION } = require("../config/pgvector");

// Schema naming convention
const SCHEMA_PREFIX = "project_";
const EMBEDDINGS_TABLE = "embeddings";

/**
 * Sanitize project ID for use in schema name
 * MongoDB ObjectIds are 24 hex characters - safe for PostgreSQL identifiers
 * 
 * @param {string} projectId - Project ID (MongoDB ObjectId)
 * @returns {string} Sanitized schema name
 */
const getSchemaName = (projectId) => {
  if (!projectId) {
    throw new Error("Project ID is required for schema name");
  }
  
  // MongoDB ObjectId: 24 hex characters (a-f, 0-9)
  const sanitized = String(projectId).toLowerCase().replace(/[^a-f0-9]/g, "");
  
  if (sanitized.length !== 24) {
    throw new Error(`Invalid project ID format: ${projectId}`);
  }
  
  return `${SCHEMA_PREFIX}${sanitized}`;
};

/**
 * Get fully qualified table name for a project
 * 
 * @param {string} projectId - Project ID
 * @returns {string} Fully qualified table name (schema.table)
 */
const getTableName = (projectId) => {
  const schema = getSchemaName(projectId);
  return `${schema}.${EMBEDDINGS_TABLE}`;
};

/**
 * Check if a project schema exists
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if schema exists
 */
const schemaExists = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata 
      WHERE schema_name = $1
    ) as exists`,
    [schemaName]
  );
  
  return result.rows[0]?.exists || false;
};

/**
 * Check if the embeddings table exists in a project schema
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if table exists
 */
const tableExists = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name = $2
    ) as exists`,
    [schemaName, EMBEDDINGS_TABLE]
  );
  
  return result.rows[0]?.exists || false;
};

/**
 * Create schema and embeddings table for a project
 * Idempotent - safe to call multiple times
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<{schemaCreated: boolean, tableCreated: boolean}>}
 */
const ensureProjectSchema = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  const tableName = getTableName(projectId);
  
  let schemaCreated = false;
  let tableCreated = false;
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // 1. Ensure pgvector extension exists (in public schema)
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    
    // 2. Create schema if not exists
    const schemaExistsBefore = await schemaExists(projectId);
    if (!schemaExistsBefore) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      schemaCreated = true;
      console.log(`✅ Created schema: ${schemaName}`);
    }
    
    // 3. Create embeddings table if not exists
    const tableExistsBefore = await tableExists(projectId);
    if (!tableExistsBefore) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}"."${EMBEDDINGS_TABLE}" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(${VECTOR_DIMENSION}),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      // 4. Create indexes for performance
      // Vector similarity index (IVFFlat for large datasets, HNSW for smaller)
      await client.query(`
        CREATE INDEX IF NOT EXISTS "${schemaName}_embeddings_vector_idx"
        ON "${schemaName}"."${EMBEDDINGS_TABLE}" 
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
      `);
      
      // Full-text search index
      await client.query(`
        CREATE INDEX IF NOT EXISTS "${schemaName}_embeddings_fts_idx"
        ON "${schemaName}"."${EMBEDDINGS_TABLE}" 
        USING GIN(to_tsvector('english', content))
      `);
      
      // Metadata indexes for common queries
      await client.query(`
        CREATE INDEX IF NOT EXISTS "${schemaName}_embeddings_metadata_idx"
        ON "${schemaName}"."${EMBEDDINGS_TABLE}" 
        USING GIN(metadata jsonb_path_ops)
      `);
      
      tableCreated = true;
      console.log(`✅ Created table: ${tableName} with indexes`);
    }
    
    await client.query("COMMIT");
    
    return { schemaCreated, tableCreated };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`❌ Failed to ensure schema for project ${projectId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Drop schema and all data for a project
 * Use with caution - this permanently deletes all project embeddings
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if schema was dropped
 */
const dropProjectSchema = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  
  const exists = await schemaExists(projectId);
  if (!exists) {
    console.log(`⚠️ Schema ${schemaName} does not exist`);
    return false;
  }
  
  await pool.query(`DROP SCHEMA "${schemaName}" CASCADE`);
  console.log(`🗑️ Dropped schema: ${schemaName}`);
  
  return true;
};

/**
 * Get statistics for a project's embeddings
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<{count: number, schemaSize: string}>}
 */
const getProjectStats = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  
  const exists = await tableExists(projectId);
  if (!exists) {
    return { count: 0, schemaSize: "0 bytes" };
  }
  
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM "${schemaName}"."${EMBEDDINGS_TABLE}"`
  );
  
  const sizeResult = await pool.query(
    `SELECT pg_size_pretty(
      COALESCE(
        (SELECT SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))
         FROM pg_tables WHERE schemaname = $1),
        0
      )
    ) as size`,
    [schemaName]
  );
  
  return {
    count: parseInt(countResult.rows[0]?.count || 0),
    schemaSize: sizeResult.rows[0]?.size || "0 bytes",
  };
};

/**
 * List all project schemas
 * 
 * @returns {Promise<Array<{schemaName: string, projectId: string}>>}
 */
const listProjectSchemas = async () => {
  const pool = getPool();
  
  const result = await pool.query(
    `SELECT schema_name FROM information_schema.schemata 
     WHERE schema_name LIKE $1
     ORDER BY schema_name`,
    [`${SCHEMA_PREFIX}%`]
  );
  
  return result.rows.map((row) => ({
    schemaName: row.schema_name,
    projectId: row.schema_name.replace(SCHEMA_PREFIX, ""),
  }));
};

/**
 * Migrate data from the old shared table to project-specific schema
 * 
 * @param {string} projectId - Project ID to migrate
 * @param {string} [sourceTable="aidlc_embeddings"] - Source table name
 * @returns {Promise<{migrated: number, skipped: number}>}
 */
const migrateProjectData = async (projectId, sourceTable = "aidlc_embeddings") => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  
  // Ensure schema exists
  await ensureProjectSchema(projectId);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Check if source table exists
    const sourceExists = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      ) as exists`,
      [sourceTable]
    );
    
    if (!sourceExists.rows[0]?.exists) {
      console.log(`⚠️ Source table ${sourceTable} does not exist`);
      return { migrated: 0, skipped: 0 };
    }
    
    // Count existing records in target
    const existingCount = await client.query(
      `SELECT COUNT(*) as count FROM "${schemaName}"."${EMBEDDINGS_TABLE}"`
    );
    const existingNum = parseInt(existingCount.rows[0]?.count || 0);
    
    if (existingNum > 0) {
      console.log(`⚠️ Target table already has ${existingNum} records, skipping migration`);
      return { migrated: 0, skipped: existingNum };
    }
    
    // Migrate data from old table to new schema
    // Note: The old table uses 'text' column, new uses 'content'
    const insertResult = await client.query(`
      INSERT INTO "${schemaName}"."${EMBEDDINGS_TABLE}" (content, metadata, embedding, created_at)
      SELECT 
        text as content,
        metadata,
        embedding,
        COALESCE(created_at, NOW())
      FROM "${sourceTable}"
      WHERE metadata->>'projectId' = $1
    `, [projectId]);
    
    const migrated = insertResult.rowCount || 0;
    
    await client.query("COMMIT");
    
    console.log(`✅ Migrated ${migrated} records to ${schemaName}`);
    
    return { migrated, skipped: 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`❌ Migration failed for project ${projectId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  // Naming functions
  getSchemaName,
  getTableName,
  
  // Schema lifecycle
  schemaExists,
  tableExists,
  ensureProjectSchema,
  dropProjectSchema,
  
  // Utilities
  getProjectStats,
  listProjectSchemas,
  migrateProjectData,
  
  // Constants
  SCHEMA_PREFIX,
  EMBEDDINGS_TABLE,
};
