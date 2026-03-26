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
 *     ├── embeddings (vector table for RAG)
 *     └── response_cache (semantic cache for agent responses)
 * 
 * NOTE: All SQL queries are centralized in common/sql-queries.js
 */

const { getPool } = require("../config/pgvector");
const {
  SCHEMA_PREFIX,
  EMBEDDINGS_TABLE,
  getSchemaName,
  getEmbeddingsTableName,
  SCHEMA_QUERIES,
  buildSchemaDDL,
  buildCacheDDL,
  MIGRATION_QUERIES,
} = require("../common/sql-queries");

// Re-export for backward compatibility
const getTableName = getEmbeddingsTableName;

/**
 * Check if a project schema exists
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if schema exists
 */
const schemaExists = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  
  const result = await pool.query(SCHEMA_QUERIES.CHECK_SCHEMA_EXISTS, [schemaName]);
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
  
  const result = await pool.query(SCHEMA_QUERIES.CHECK_TABLE_EXISTS, [schemaName, EMBEDDINGS_TABLE]);
  return result.rows[0]?.exists || false;
};

/**
 * Check if cache table exists in a project schema
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if table exists
 */
const cacheTableExists = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  
  const result = await pool.query(SCHEMA_QUERIES.CHECK_TABLE_EXISTS, [schemaName, "response_cache"]);
  return result.rows[0]?.exists || false;
};

/**
 * Create schema and embeddings table for a project
 * Idempotent - safe to call multiple times
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<{schemaCreated: boolean, tableCreated: boolean, cacheTableCreated: boolean}>}
 */
const ensureProjectSchema = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  const ddl = buildSchemaDDL(schemaName);
  
  let schemaCreated = false;
  let tableCreated = false;
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // 1. Ensure pgvector extension exists
    await client.query(ddl.CREATE_EXTENSION);
    
    // 2. Create schema if not exists
    const schemaExistsBefore = await schemaExists(projectId);
    if (!schemaExistsBefore) {
      await client.query(ddl.CREATE_SCHEMA);
      schemaCreated = true;
      console.log(`✅ Created schema: ${schemaName}`);
    }
    
    // 3. Create embeddings table if not exists
    const tableExistsBefore = await tableExists(projectId);
    if (!tableExistsBefore) {
      await client.query(ddl.CREATE_EMBEDDINGS_TABLE);
      await client.query(ddl.CREATE_VECTOR_INDEX);
      await client.query(ddl.CREATE_FTS_INDEX);
      await client.query(ddl.CREATE_METADATA_INDEX);
      
      tableCreated = true;
      console.log(`✅ Created embeddings table in ${schemaName} with indexes`);
    }
    
    // 4. Create response_cache table if not exists
    const cacheTableCreated = await ensureCacheTableInternal(client, schemaName);
    
    await client.query("COMMIT");
    
    return { schemaCreated, tableCreated, cacheTableCreated };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`❌ Failed to ensure schema for project ${projectId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Internal helper to create cache table within a transaction
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @returns {Promise<boolean>} True if table was created
 */
const ensureCacheTableInternal = async (client, schemaName) => {
  // Check if cache table exists
  const tableCheck = await client.query(
    SCHEMA_QUERIES.CHECK_TABLE_EXISTS,
    [schemaName, "response_cache"]
  );
  
  if (tableCheck.rows[0]?.exists) {
    return false; // Already exists
  }
  
  const ddl = buildCacheDDL(schemaName);
  
  await client.query(ddl.CREATE_CACHE_TABLE);
  await client.query(ddl.CREATE_CACHE_EXACT_INDEX);
  await client.query(ddl.CREATE_CACHE_SEMANTIC_INDEX);
  await client.query(ddl.CREATE_CACHE_EXPIRY_INDEX);
  await client.query(ddl.CREATE_CACHE_KB_VERSION_INDEX);
  
  console.log(`✅ Created response_cache table in ${schemaName}`);
  return true;
};

/**
 * Ensure cache table exists for a project (standalone, for migrations)
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if table was created
 */
const ensureCacheTable = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    const created = await ensureCacheTableInternal(client, schemaName);
    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`❌ Failed to ensure cache table for ${projectId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Drop schema and all data for a project
 * Use with caution - this permanently deletes all project data
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if schema was dropped
 */
const dropProjectSchema = async (projectId) => {
  const pool = getPool();
  const schemaName = getSchemaName(projectId);
  const ddl = buildSchemaDDL(schemaName);
  
  const exists = await schemaExists(projectId);
  if (!exists) {
    console.log(`⚠️ Schema ${schemaName} does not exist`);
    return false;
  }
  
  await pool.query(ddl.DROP_SCHEMA);
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
  
  const countResult = await pool.query(SCHEMA_QUERIES.GET_PROJECT_STATS(schemaName));
  const sizeResult = await pool.query(SCHEMA_QUERIES.GET_SCHEMA_SIZE, [schemaName]);
  
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
  
  const result = await pool.query(SCHEMA_QUERIES.LIST_PROJECT_SCHEMAS, [`${SCHEMA_PREFIX}%`]);
  
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
    const sourceExists = await client.query(MIGRATION_QUERIES.CHECK_SOURCE_TABLE, [sourceTable]);
    
    if (!sourceExists.rows[0]?.exists) {
      console.log(`⚠️ Source table ${sourceTable} does not exist`);
      return { migrated: 0, skipped: 0 };
    }
    
    // Count existing records in target
    const existingCount = await client.query(MIGRATION_QUERIES.COUNT_TARGET_RECORDS(schemaName));
    const existingNum = parseInt(existingCount.rows[0]?.count || 0);
    
    if (existingNum > 0) {
      console.log(`⚠️ Target table already has ${existingNum} records, skipping migration`);
      return { migrated: 0, skipped: existingNum };
    }
    
    // Migrate data
    const insertResult = await client.query(
      MIGRATION_QUERIES.MIGRATE_DATA(schemaName, sourceTable),
      [projectId]
    );
    
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
  // Naming functions (re-exported from sql-queries for compatibility)
  getSchemaName,
  getTableName,
  
  // Schema lifecycle
  schemaExists,
  tableExists,
  cacheTableExists,
  ensureProjectSchema,
  ensureCacheTable,
  dropProjectSchema,
  
  // Utilities
  getProjectStats,
  listProjectSchemas,
  migrateProjectData,
  
  // Constants
  SCHEMA_PREFIX,
  EMBEDDINGS_TABLE,
};
