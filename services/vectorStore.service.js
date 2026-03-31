/**
 * Vector Store Service
 * 
 * Clean vector storage service using LangChain's PGVectorStore.
 * Provides a simple interface for embedding operations.
 * 
 * SCHEMA-PER-PROJECT ISOLATION:
 * Each project gets its own PostgreSQL schema (project_{id}) with its own
 * embeddings table. This provides database-level isolation for:
 * - Data security (no cross-project data leaks)
 * - Independent backup/restore
 * - Per-project scaling
 */

const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { getConnectionConfig, getProjectConnectionConfig, VECTOR_DIMENSION } = require("../config/pgvector");
const { ensureProjectSchema, getTableName } = require("./schemaManager.service");

// Configuration
const EMBEDDING_MODEL = "azure.text-embedding-3-large";
const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SIMILARITY_SCORE = 0.5;

// Cache for embeddings clients and vector stores per project
const embeddingsCache = new Map();
const vectorStoreCache = new Map();

// Per-request embedding cache to avoid duplicate embedQuery calls for the same query text
// Key: `${projectId}:${queryText}`, Value: embedding vector (float[])
// Cleared automatically via short TTL (30s) to avoid stale data
const queryEmbeddingCache = new Map();
const QUERY_EMBEDDING_TTL_MS = 30000;

/**
 * Get a cached embedding for a query, or compute and cache it
 * Prevents the same query text from being embedded 3x in a single request pipeline
 * 
 * @param {Object} project - Project object
 * @param {string} query - Query text 
 * @returns {Promise<number[]>} Embedding vector
 */
const getCachedQueryEmbedding = async (project, query) => {
  const projectId = String(project._id);
  const cacheKey = `${projectId}:${query}`;
  
  const cached = queryEmbeddingCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.embedding;
  }
  
  const embeddings = createEmbeddingsClient(project);
  const embedding = await embeddings.embedQuery(query);
  
  queryEmbeddingCache.set(cacheKey, {
    embedding,
    expiresAt: Date.now() + QUERY_EMBEDDING_TTL_MS,
  });
  
  // Lazy cleanup of expired entries
  if (queryEmbeddingCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of queryEmbeddingCache) {
      if (now > v.expiresAt) queryEmbeddingCache.delete(k);
    }
  }
  
  return embedding;
};

/**
 * Create embeddings client for a project
 * @param {Object} project - Project object with openapikey
 * @returns {OpenAIEmbeddings} Embeddings client
 */
const createEmbeddingsClient = (project) => {
  const projectId = String(project?._id || "");
  
  if (!projectId) {
    throw new Error("Project with _id is required for embeddings");
  }
  
  if (embeddingsCache.has(projectId)) {
    return embeddingsCache.get(projectId);
  }
  
  const openaiApiKey = project?.openapikey;
  if (!openaiApiKey) {
    throw new Error(`Project ${projectId} requires openapikey for embeddings`);
  }
  
  const client = new OpenAIEmbeddings({
    model: EMBEDDING_MODEL,
    openAIApiKey: openaiApiKey,
    configuration: { baseURL: process.env.OPENAPI_URL },
    dimensions: VECTOR_DIMENSION,
  });
  
  embeddingsCache.set(projectId, client);
  return client;
};

/**
 * Get or create a PGVectorStore instance for a project
 * Uses schema-per-project isolation for security
 * 
 * @param {Object} project - Project object with _id and openapikey
 * @returns {Promise<PGVectorStore>} Vector store instance
 */
const getVectorStore = async (project) => {
  const projectId = String(project?._id || "");
  
  if (!projectId) {
    throw new Error("Project with _id is required");
  }
  
  // Cache key includes schema for clarity
  const cacheKey = `schema_${projectId}`;
  
  if (vectorStoreCache.has(cacheKey)) {
    return vectorStoreCache.get(cacheKey);
  }
  
  // Ensure project schema and table exist before connecting
  await ensureProjectSchema(projectId);
  
  const embeddings = createEmbeddingsClient(project);
  const config = getProjectConnectionConfig(projectId);
  
  // Initialize PGVectorStore with project-specific table
  // Table name is now schema-qualified: project_{id}.embeddings
  const vectorStore = await PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: config.postgresConnectionOptions,
    tableName: config.tableName,
    distanceStrategy: "cosine",
    // Use 'content' column to match our schema
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
  });
  
  vectorStoreCache.set(cacheKey, vectorStore);
  console.log(`✅ Vector store initialized for project ${projectId} (schema-isolated)`);
  
  return vectorStore;
};

/**
 * Add documents to vector store
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {Array<{pageContent: string, metadata: object}>} options.documents - LangChain documents
 * @returns {Promise<string[]>} Array of document IDs
 */
const addDocuments = async ({ project, documents }) => {
  if (!documents?.length) return [];
  
  const vectorStore = await getVectorStore(project);
  const ids = await vectorStore.addDocuments(documents);
  const count = ids?.length || documents.length;
  
  console.log(`✅ Added ${count} documents for project ${project._id}`);
  return ids || [];
};

/**
 * Query similar documents using similarity search
 * 
 * Note: With schema-per-project isolation, we no longer need to filter by projectId
 * since each project's data is in its own schema. This provides database-level isolation.
 * 
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {string} options.query - Query text
 * @param {number} [options.topK=5] - Number of results
 * @param {Object} [options.filter] - Metadata filter (repoId, repoTag, etc.)
 * @returns {Promise<Array<{content: string, metadata: object, score: number}>>}
 */
const similaritySearch = async ({ 
  project, 
  query, 
  topK = DEFAULT_TOP_K,
  filter = {},
  minScore = DEFAULT_MIN_SIMILARITY_SCORE
}) => {
  if (!query?.trim()) throw new Error("Query is required");
  
  const vectorStore = await getVectorStore(project);
  
  // No need to add projectId filter - schema isolation handles it
  // Only include actual filter criteria (repoId, repoTag, etc.)
  const results = await vectorStore.similaritySearchWithScore(query, topK, filter);
  
  return results
    .filter(([, score]) => score >= minScore)
    .map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      score: parseFloat(score.toFixed(4)),
    }));
};

/**
 * Delete documents by filter
 * 
 * Note: With schema-per-project isolation, we don't need projectId filter.
 * The schema ensures data isolation at the database level.
 * 
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {Object} [options.filter] - Metadata filter for deletion (repoId, scope, etc.)
 * @returns {Promise<void>}
 */
const deleteDocuments = async ({ project, filter = {} }) => {
  const vectorStore = await getVectorStore(project);
  
  // No projectId needed - schema isolation handles it
  await vectorStore.delete({ filter: fullFilter });
  console.log(`🗑️ Deleted documents for project ${project._id}`);
};

/**
 * Clear all documents for a project
 * @param {Object} project - Project object
 * @returns {Promise<void>}
 */
const clearProjectDocuments = async (project) => {
  const vectorStore = await getVectorStore(project);
  await vectorStore.delete({ filter: {} });
  console.log(`🗑️ Cleared all documents for project ${project._id}`);
};

/**
 * Clear cache for a project (useful when API key changes)
 * @param {string} [projectId] - Project ID or clear all if not provided
 */
const clearCache = (projectId) => {
  if (projectId) {
    const cacheKey = `schema_${projectId}`;
    embeddingsCache.delete(projectId);
    vectorStoreCache.delete(cacheKey);
  } else {
    embeddingsCache.clear();
    vectorStoreCache.clear();
  }
};

/**
 * Close all vector store connections
 */
const closeAll = async () => {
  for (const [, store] of vectorStoreCache) {
    try {
      await store.end?.();
    } catch (err) {
      // Ignore close errors
    }
  }
  vectorStoreCache.clear();
  embeddingsCache.clear();
  console.log("✅ Vector store connections closed");
};

// Lazy-load hybrid search to avoid circular dependencies
let _hybridSearchService = null;
const getHybridSearchService = () => {
  if (!_hybridSearchService) {
    _hybridSearchService = require("./hybridSearch.service");
  }
  return _hybridSearchService;
};

/**
 * Hybrid search combining semantic (vector) and keyword (BM25) search
 * Uses Reciprocal Rank Fusion (RRF) for result merging
 * 
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {string} options.query - Search query
 * @param {number} [options.topK=5] - Number of results
 * @param {Object} [options.filter] - Metadata filter
 * @param {number} [options.minScore] - Minimum similarity threshold
 * @returns {Promise<Array<{content: string, metadata: object, score: number}>>}
 */
const hybridSearch = async (options) => {
  const { hybridSearch: doHybridSearch } = getHybridSearchService();
  return doHybridSearch({
    ...options,
    semanticSearchFn: similaritySearch,
  });
};

module.exports = {
  getVectorStore,
  createEmbeddingsClient,
  getCachedQueryEmbedding,
  addDocuments,
  similaritySearch,
  hybridSearch,
  deleteDocuments,
  clearProjectDocuments,
  clearCache,
  closeAll,
  DEFAULT_TOP_K,
  DEFAULT_MIN_SIMILARITY_SCORE,
};
