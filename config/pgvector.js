/**
 * PG Vector Configuration
 * 
 * Simplified PostgreSQL connection configuration for LangChain's PGVectorStore.
 * Table creation and indexing are handled automatically by LangChain.
 */

const { Pool } = require("pg");

// Configuration constants
const VECTOR_DIMENSION = 1536;
const TABLE_NAME = "aidlc_embeddings"; // Project-specific embeddings table

let pool = null;

/**
 * Get PostgreSQL connection configuration
 * @returns {Object} Connection configuration for LangChain PGVectorStore
 */
const getConnectionConfig = () => {
  const connectionString = process.env.PGVECTOR_DATABASE_URL;

  if (!connectionString) {
    throw new Error("PGVECTOR_DATABASE_URL environment variable is required");
  }

  // Determine if SSL is needed (external connections usually require SSL)
  const isExternalConnection =
    connectionString.includes(".render.com") ||
    connectionString.includes(".amazonaws.com") ||
    connectionString.includes(".azure.com") ||
    process.env.PGVECTOR_SSL === "true";

  return {
    postgresConnectionOptions: {
      connectionString,
      ssl: isExternalConnection ? { rejectUnauthorized: false } : false,
    },
    tableName: TABLE_NAME,
  };
};

/**
 * Get or create the PostgreSQL connection pool (for health checks only)
 * @returns {Pool} PostgreSQL connection pool
 */
const getPool = () => {
  if (!pool) {
    const connectionString = process.env.PGVECTOR_DATABASE_URL;

    if (!connectionString) {
      throw new Error("PGVECTOR_DATABASE_URL environment variable is required");
    }

    const isExternalConnection =
      connectionString.includes(".render.com") ||
      connectionString.includes(".amazonaws.com") ||
      connectionString.includes(".azure.com") ||
      process.env.PGVECTOR_SSL === "true";

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: isExternalConnection ? { rejectUnauthorized: false } : false,
    });

    pool.on("error", (err) => {
      console.error("❌ PG Vector pool error:", err.message);
    });

    console.log("✅ PG Vector connection pool created");
  }

  return pool;
};

/**
 * Close the connection pool gracefully
 */
const closePgVector = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("✅ PG Vector connection pool closed");
  }
};

/**
 * Health check for PG Vector
 * @returns {Promise<{healthy: boolean, latency: number}>}
 */
const healthCheck = async () => {
  const start = Date.now();
  try {
    const client = await getPool().connect();
    try {
      await client.query("SELECT 1");
      return { healthy: true, latency: Date.now() - start };
    } finally {
      client.release();
    }
  } catch (err) {
    return { healthy: false, latency: Date.now() - start, error: err.message };
  }
};

/**
 * Initialize PG Vector connection and ensure required indexes exist
 * Call this once during server startup
 * 
 * @returns {Promise<{healthy: boolean, ftsIndex: boolean}>}
 */
const initializePgVector = async () => {
  const result = { healthy: false, ftsIndex: false };

  // Health check
  const pgHealth = await healthCheck();
  if (pgHealth.healthy) {
    console.log(`✅ PG Vector connected (${pgHealth.latency}ms)`);
    result.healthy = true;

    // Ensure FTS index exists for hybrid search
    try {
      const { ensureFtsIndex } = require("../common/sql-queries");
      const indexResult = await ensureFtsIndex(getPool());
      result.ftsIndex = indexResult.created || indexResult.existed;
    } catch (err) {
      console.warn(`⚠️ FTS index setup skipped: ${err.message}`);
    }
  } else {
    console.warn(`⚠️ PG Vector connection issue: ${pgHealth.error}`);
  }

  return result;
};

module.exports = {
  getConnectionConfig,
  getPool,
  closePgVector,
  healthCheck,
  initializePgVector,
  VECTOR_DIMENSION,
  TABLE_NAME,
};
