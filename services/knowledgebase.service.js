const Doc = require("../models/DocModel");
const SyncStatus = require("../models/SyncStatusModel");
const projectService = require("./project.service");
const PUBLIC_BASE = "/public/uploads/knowledgebase";
const { generateAndStoreEmbeddings, syncCodebase, syncCodebaseAsync } = require("../helpers/embaddingHelpers")

const buildPublicUrl = (req, fileName) => {
  const host = req.get("host");
  return `${req.protocol}://${host}${PUBLIC_BASE}/${encodeURIComponent(fileName)}`;
};

const saveKnowledgeDocument = async ({ req, file, projectId }) => {
  const doc = await Doc.create({
    fileName: file.originalname,
    isAnalysized: false,
    fileurl: buildPublicUrl(req, file.filename),
    project_id: projectId,
  });

  return doc;
};

const getKnowledgeDocumentsByProjectId = async (projectId) => {
  return await Doc.find({ project_id: projectId }).sort({ createdAt: -1 });
};

const analyzeKnowledgeDocument = async (docId) => {
  const doc = await Doc.findById(docId);
  if (!doc) return null;

  const result = await generateAndStoreEmbeddings({ url: doc.fileurl, projectId: doc.project_id });

  if(!result.success) throw new Error("Failed to analyze document");

  doc.isAnalysized = true;
  await doc.save();

  return doc;
};

/**
 * Analyze a repository for a project
 * @param {string} projectId - The project ID
 * @param {string} [repoId] - Optional repository ID (for multi-repo projects)
 * @returns {Promise<Object>} Sync result
 */
const analyzeKnowledgeRepository = async (projectId, repoId = null) => {
  const project = await projectService.getProjectById(projectId);
  if (!project) return null;

  // Determine which repository to analyze
  let repoData = null;
  if (repoId) {
    // Multi-repo: Find specific repository
    const repo = project.repositories?.find((r) => r._id.toString() === repoId);
    if (!repo) {
      throw new Error("Repository not found");
    }
    repoData = {
      repolink: repo.repolink,
      identifier: repo.identifier,
      tag: repo.tag,
      repoId: repo._id.toString(),
    };
  } else if (project.repolink) {
    // Legacy: Use single repolink field
    repoData = {
      repolink: project.repolink,
      identifier: "default",
      tag: "backend",
      repoId: null,
    };
  } else {
    throw new Error("No repository configured for this project");
  }

  // Use async version - returns immediately with sync status ID
  const result = await syncCodebaseAsync(projectId, repoData);

  return {
    success: true,
    syncId: result.syncId,
    status: result.status,
    message: result.message,
    alreadyRunning: result.alreadyRunning || false,
    repoId: repoData.repoId,
    identifier: repoData.identifier,
  };
};

/**
 * Get the current sync status for a project
 * @param {string} projectId - The project ID
 * @param {string} [syncType] - The sync type (default: "codebase")
 * @returns {Promise<Object|null>} The sync status or null if not found
 */
const getSyncStatus = async (projectId, syncType = "codebase") => {
  const syncStatus = await SyncStatus.getLatestByProject(projectId, syncType);
  
  if (!syncStatus) {
    return null;
  }
  
  return {
    syncId: syncStatus._id.toString(),
    projectId: syncStatus.project_id.toString(),
    syncType: syncStatus.syncType,
    status: syncStatus.status,
    description: syncStatus.description,
    startedAt: syncStatus.startedAt,
    completedAt: syncStatus.completedAt,
    progress: syncStatus.progress,
    stats: syncStatus.stats,
    error: syncStatus.error?.message ? syncStatus.error : null,
    repoInfo: syncStatus.repoInfo,
    createdAt: syncStatus.createdAt,
    updatedAt: syncStatus.updatedAt,
  };
};

/**
 * Get sync status by sync ID
 * @param {string} syncId - The sync status ID
 * @returns {Promise<Object|null>} The sync status or null if not found
 */
const getSyncStatusById = async (syncId) => {
  const syncStatus = await SyncStatus.findById(syncId);
  
  if (!syncStatus) {
    return null;
  }
  
  return {
    syncId: syncStatus._id.toString(),
    projectId: syncStatus.project_id.toString(),
    syncType: syncStatus.syncType,
    status: syncStatus.status,
    description: syncStatus.description,
    startedAt: syncStatus.startedAt,
    completedAt: syncStatus.completedAt,
    progress: syncStatus.progress,
    stats: syncStatus.stats,
    error: syncStatus.error?.message ? syncStatus.error : null,
    repoInfo: syncStatus.repoInfo,
    createdAt: syncStatus.createdAt,
    updatedAt: syncStatus.updatedAt,
  };
};

/**
 * Get sync history for a project
 * @param {string} projectId - The project ID
 * @param {number} [limit] - Maximum number of records to return
 * @returns {Promise<Array>} Array of sync status records
 */
const getSyncHistory = async (projectId, limit = 10) => {
  const syncStatuses = await SyncStatus.find({ project_id: projectId })
    .sort({ createdAt: -1 })
    .limit(limit);
  
  return syncStatuses.map(s => ({
    syncId: s._id.toString(),
    syncType: s.syncType,
    status: s.status,
    description: s.description,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    stats: s.stats,
    error: s.error?.message ? s.error : null,
    repoInfo: s.repoInfo || null,
    createdAt: s.createdAt,
  }));
};

module.exports = {
  saveKnowledgeDocument,
  getKnowledgeDocumentsByProjectId,
  analyzeKnowledgeDocument,
  analyzeKnowledgeRepository,
  getSyncStatus,
  getSyncStatusById,
  getSyncHistory,
};
