/**
 * Indexing Service
 * 
 * Provides document indexing with deduplication using LangChain's PGVectorStore.
 * Uses content hashing to prevent duplicate embeddings.
 * 
 * SCHEMA-PER-PROJECT ISOLATION:
 * Documents are now stored in project-specific schemas (project_{id}.embeddings).
 * The vectorStore.service automatically ensures the schema exists before indexing.
 * ProjectId is kept in metadata for debugging/analytics purposes, but schema isolation
 * provides the actual security boundary.
 */

const crypto = require("crypto");
const { getVectorStore, deleteDocuments } = require("./vectorStore.service");

/**
 * Generate a hash for document content (for deduplication)
 * @param {string} content - Document content
 * @returns {string} Content hash
 */
const hashContent = (content) => {
  return crypto.createHash("md5").update(content).digest("hex");
};

/**
 * Index documents with deduplication
 * 
 * @param {Object} options
 * @param {Object} options.project - Project object with _id and openapikey
 * @param {Array<Document>} options.documents - LangChain documents to index
 * @param {string} [options.scope] - Scope for isolation (e.g., "webpage", "codebase")
 * @param {boolean} [options.fullSync=false] - If true, clear existing docs first
 * @returns {Promise<{numAdded: number, numSkipped: number, numDeleted: number}>}
 */
const indexDocuments = async ({
  project,
  documents,
  scope = "default",
  fullSync = false,
}) => {
  const projectId = String(project?._id || "");
  
  if (!projectId) {
    throw new Error("Project with _id is required");
  }
  
  if (!documents?.length) {
    return { numAdded: 0, numSkipped: 0, numDeleted: 0 };
  }
  
  console.log(`📥 Indexing ${documents.length} documents (scope: ${scope})...`);
  
  const vectorStore = await getVectorStore(project);
  let numDeleted = 0;
  
  // Full sync: clear existing documents for this scope
  if (fullSync) {
    try {
      await deleteDocuments({ project, filter: { scope } });
      console.log(`🗑️ Cleared existing ${scope} documents`);
    } catch (err) {
      // Ignore if nothing to delete
    }
  }
  
  // Prepare documents with hashed IDs for deduplication
  const docsToIndex = documents.map((doc) => ({
    pageContent: doc.pageContent,
    metadata: {
      ...doc.metadata,
      scope,
      projectId,
      contentHash: hashContent(doc.pageContent),
    },
  }));
  
  // Add documents to vector store
  const ids = await vectorStore.addDocuments(docsToIndex);
  const numAdded = ids?.length || docsToIndex.length;
  
  console.log(`✅ Indexed ${numAdded} documents`);
  
  return {
    numAdded,
    numSkipped: documents.length - numAdded,
    numDeleted,
  };
};

/**
 * Index webpage documents
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {Array<Document>} options.documents - Documents from web loader
 * @param {string} options.url - Source URL
 * @returns {Promise<Object>} Indexing result
 */
const indexWebpage = async ({ project, documents, url }) => {
  // Add source URL to all documents
  const docsWithMetadata = documents.map((doc) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      source: url,
    },
  }));
  
  return indexDocuments({
    project,
    documents: docsWithMetadata,
    scope: "webpage",
    fullSync: false, // Incremental for webpages
  });
};

/**
 * Index codebase documents (full sync - replaces all codebase docs for the repo)
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {Array<Document>} options.documents - Documents from GitHub loader
 * @param {Object} [options.repoMetadata] - Repository metadata for multi-repo support
 * @param {string} [options.repoMetadata.repoId] - Repository subdocument ID
 * @param {string} [options.repoMetadata.identifier] - Repository identifier/name
 * @param {string} [options.repoMetadata.tag] - Repository tag (frontend/backend/etc)
 * @param {string} [options.repoMetadata.repoUrl] - Repository URL
 * @returns {Promise<Object>} Indexing result
 */
const indexCodebase = async ({ project, documents, repoMetadata = null }) => {
  // Determine scope - use repo-specific scope if repoId provided
  const scope = repoMetadata?.repoId ? `codebase:${repoMetadata.repoId}` : "codebase";
  
  // Add repository metadata to all documents
  const docsWithRepoMetadata = documents.map((doc) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      // Repository identification
      repoId: repoMetadata?.repoId || null,
      repoIdentifier: repoMetadata?.identifier || "default",
      repoTag: repoMetadata?.tag || "backend",
      repoUrl: repoMetadata?.repoUrl || null,
    },
  }));
  
  return indexDocuments({
    project,
    documents: docsWithRepoMetadata,
    scope,
    fullSync: true, // Full sync for codebase (within scope)
  });
};

/**
 * Clear all indexed documents for a scope
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {string} options.scope - Scope to clear
 * @returns {Promise<void>}
 */
const clearScope = async ({ project, scope }) => {
  await deleteDocuments({ project, filter: { scope } });
  console.log(`🗑️ Cleared scope: ${scope}`);
};

module.exports = {
  indexDocuments,
  indexWebpage,
  indexCodebase,
  clearScope,
};
