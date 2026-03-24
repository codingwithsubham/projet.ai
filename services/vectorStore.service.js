/**
 * Vector Store Service
 * 
 * Clean vector storage service using LangChain's PGVectorStore.
 * Provides a simple interface for embedding operations.
 */

const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { getConnectionConfig, VECTOR_DIMENSION } = require("../config/pgvector");

// Configuration
const EMBEDDING_MODEL = "azure.text-embedding-3-large";
const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SIMILARITY_SCORE = 0.5;

// Cache for embeddings clients and vector stores per project
const embeddingsCache = new Map();
const vectorStoreCache = new Map();

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
 * @param {Object} project - Project object with _id and openapikey
 * @returns {Promise<PGVectorStore>} Vector store instance
 */
const getVectorStore = async (project) => {
  const projectId = String(project?._id || "");
  
  if (!projectId) {
    throw new Error("Project with _id is required");
  }
  
  if (vectorStoreCache.has(projectId)) {
    return vectorStoreCache.get(projectId);
  }
  
  const embeddings = createEmbeddingsClient(project);
  const config = getConnectionConfig();
  
  // Initialize PGVectorStore - LangChain will create the table automatically
  const vectorStore = await PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: config.postgresConnectionOptions,
    tableName: config.tableName,
    distanceStrategy: "cosine",
  });
  
  vectorStoreCache.set(projectId, vectorStore);
  console.log(`✅ Vector store initialized for project ${projectId}`);
  
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
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {string} options.query - Query text
 * @param {number} [options.topK=5] - Number of results
 * @param {Object} [options.filter] - Metadata filter
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
  
  const projectId = String(project?._id || "");
  const vectorStore = await getVectorStore(project);
  
  // Always filter by projectId for isolation
  const fullFilter = { ...filter, projectId };
  
  const results = await vectorStore.similaritySearchWithScore(query, topK, fullFilter);
  
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
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {Object} [options.filter] - Metadata filter for deletion
 * @returns {Promise<void>}
 */
const deleteDocuments = async ({ project, filter = {} }) => {
  const projectId = String(project?._id || "");
  const vectorStore = await getVectorStore(project);
  
  // Always include projectId in filter for safety
  const fullFilter = { ...filter, projectId };
  
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
    embeddingsCache.delete(projectId);
    vectorStoreCache.delete(projectId);
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
