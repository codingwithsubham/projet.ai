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

module.exports = {
  getConnectionConfig,
  getPool,
  closePgVector,
  healthCheck,
  VECTOR_DIMENSION,
  TABLE_NAME,
};
