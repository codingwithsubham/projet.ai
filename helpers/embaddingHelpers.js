/**
 * Embedding Helpers
 * 
 * High-level orchestration layer for document embedding operations.
 * Uses LangChain's indexing API with Record Manager for deduplication.
 */

const { loadWebDocument, loadGithubRepo, countUniqueFiles } = require("./documentLoaders");
const { indexWebpage, indexCodebase } = require("../services/indexing.service");
const { similaritySearch } = require("../services/vectorStore.service");
const projectService = require("../services/project.service");
const SyncStatus = require("../models/SyncStatusModel");

/**
 * Generate embeddings and store for a web document.
 * Uses Record Manager to prevent duplicates automatically.
 * 
 * @param {Object} options
 * @param {string} options.url - Web page URL
 * @param {string} options.projectId - Project ID
 * @returns {Promise<Object>} Indexing result
 */
const generateAndStoreEmbeddings = async ({ url, projectId }) => {
  console.log(`\n🚀 Indexing webpage: ${url}`);
  
  if (!url || !projectId) {
    throw new Error("url and projectId are required");
  }
  
  // Get project details
  const project = await projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  
  // Load and split document
  const documents = await loadWebDocument(url);
  
  if (!documents.length) {
    console.log("⚠️ No content found in document");
    return { success: true, numAdded: 0, numUpdated: 0, numSkipped: 0, numDeleted: 0 };
  }
  
  // Index with automatic deduplication
  const result = await indexWebpage({ project, documents, url });
  
  return {
    success: true,
    ...result,
  };
};

/**
 * Sync a GitHub codebase (synchronous version).
 * Uses Record Manager with full cleanup for complete sync.
 * 
 * @param {Object} options
 * @param {string} options.projectId - Project ID
 * @param {Object} [options.syncStatus] - SyncStatus document for progress updates
 * @returns {Promise<Object>} Sync result
 */
const syncCodebase = async ({ projectId, syncStatus = null, repoData = null }) => {
  console.log(`\n🔄 Syncing codebase for project: ${projectId}`);
  
  if (!projectId) {
    throw new Error("projectId is required");
  }
  
  const updateProgress = async (step, percentage) => {
    if (syncStatus) {
      try {
        await syncStatus.updateProgress(step, percentage);
      } catch (e) {
        console.warn("Failed to update sync progress:", e.message);
      }
    }
  };
  
  // Get project details
  const project = await projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Determine repository URL - use provided repoData or fallback to project.repolink
  const repoUrl = repoData?.repolink || project.repolink;
  const repoIdentifier = repoData?.identifier || "default";
  
  if (!repoUrl) {
    throw new Error("No repository link configured");
  }
  
  console.log(`📦 Repository: ${repoIdentifier} (${repoUrl})`);
  
  await updateProgress("Loading repository from GitHub...", 10);
  
  // Load repository
  const documents = await loadGithubRepo({
    repoUrl,
    patToken: project.pat_token,
    branch: "main",
  });
  
  await updateProgress("Processing repository files...", 40);
  
  if (!documents.length) {
    console.log("⚠️ No content found in repository");
    return { success: true, numAdded: 0, numUpdated: 0, numSkipped: 0, numDeleted: 0, totalFiles: 0, totalChunks: 0 };
  }
  
  await updateProgress("Indexing documents...", 60);
  
  // Index with full cleanup (replaces all codebase docs for this repo)
  // Pass repository metadata for context filtering
  const result = await indexCodebase({
    project,
    documents,
    repoMetadata: {
      repoId: repoData?.repoId || null,
      identifier: repoIdentifier,
      tag: repoData?.tag || "backend",
      repoUrl,
    },
  });
  
  await updateProgress("Finalizing...", 95);
  
  const totalFiles = countUniqueFiles(documents);
  const totalChunks = result.numAdded || 0;
  
  console.log(`✅ Indexed ${totalChunks} chunks from ${totalFiles} files`);
  
  return {
    success: true,
    ...result,
    totalFiles,
    totalChunks,
  };
};

/**
 * Start async codebase sync - returns immediately with sync status ID.
 * 
 * @param {string} projectId - Project ID
 * @param {Object} [repoData] - Optional repository data for multi-repo projects
 * @param {string} repoData.repolink - Repository URL
 * @param {string} repoData.identifier - Repository identifier
 * @param {string} repoData.tag - Repository tag (frontend/backend/etc)
 * @param {string} repoData.repoId - Repository subdocument ID
 * @returns {Promise<Object>} Sync status info
 */
const syncCodebaseAsync = async (projectId, repoData = null) => {
  console.log(`\n🚀 Starting async sync for project: ${projectId}`);
  
  if (!projectId) {
    throw new Error("projectId is required");
  }

  const repoId = repoData?.repoId || null;
  
  // Check if sync is already in progress for this specific repo
  const isInProgress = await SyncStatus.isSyncInProgress(projectId, "codebase", repoId);
  if (isInProgress) {
    const existingSync = await SyncStatus.getLatestByProject(projectId, "codebase", repoId);
    return {
      syncId: existingSync._id.toString(),
      status: existingSync.status,
      message: "A sync operation is already in progress for this repository",
      alreadyRunning: true,
    };
  }
  
  // Validate project
  const project = await projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Determine repository URL
  const repoUrl = repoData?.repolink || project.repolink;
  const repoIdentifier = repoData?.identifier || "default";
  
  if (!repoUrl) {
    throw new Error("No repository link configured");
  }
  
  // Create sync status record
  const syncStatus = await SyncStatus.create({
    project_id: projectId,
    syncType: "codebase",
    status: "pending",
    description: `Syncing repository: ${repoIdentifier} (${repoUrl})`,
    repoInfo: {
      url: repoUrl,
      branch: "main",
      identifier: repoIdentifier,
      tag: repoData?.tag || "backend",
      repoId: repoId,
    },
  });
  
  console.log(`📋 Created sync status: ${syncStatus._id}`);
  
  // Start background sync
  setImmediate(async () => {
    try {
      await syncStatus.markInProgress("Initializing sync...");
      const result = await syncCodebase({ projectId, syncStatus, repoData });
      await syncStatus.markCompleted({
        totalFiles: result.totalFiles || 0,
        totalChunks: result.totalChunks || 0,
        inserted: result.numAdded || 0,
        updated: 0,
        deleted: result.numDeleted || 0,
        skipped: result.numSkipped || 0,
      });
      console.log(`✅ Async sync completed for project: ${projectId}, repo: ${repoIdentifier}`);
    } catch (err) {
      console.error(`❌ Async sync failed for project: ${projectId}`, err);
      await syncStatus.markFailed(err);
    }
  });
  
  return {
    syncId: syncStatus._id.toString(),
    status: "pending",
    message: "Repository sync started. Use the sync status endpoint to track progress.",
    alreadyRunning: false,
  };
};

/**
 * Query vectors for RAG context
 * 
 * @param {Object} options
 * @param {Object} options.project - Project object
 * @param {string} options.query - Query text
 * @param {number} [options.topK=5] - Number of results
 * @param {Object} [options.filter] - Optional metadata filter (e.g., { repoId, repoTag })
 * @returns {Promise<Array>} Relevant documents with repository metadata
 */
const queryVectors = async ({ project, query, topK = 5, filter = {}, minScore = null }) => {
  console.log(`\n🔍 Querying vectors for project: ${project?._id}`);
  
  const searchOptions = { project, query, topK, filter };
  if (minScore !== null) searchOptions.minScore = minScore;
  
  const results = await similaritySearch(searchOptions);
  
  console.log(`✅ Found ${results.length} relevant chunks`);
  
  // Ensure repository metadata is included in results
  return results.map((result) => ({
    ...result,
    metadata: {
      ...result.metadata,
      // Ensure repo metadata fields are accessible
      repoId: result.metadata?.repoId || null,
      repoIdentifier: result.metadata?.repoIdentifier || "default",
      repoTag: result.metadata?.repoTag || "unknown",
      repoUrl: result.metadata?.repoUrl || null,
    },
  }));
};

module.exports = {
  generateAndStoreEmbeddings,
  syncCodebase,
  syncCodebaseAsync,
  queryVectors,
};