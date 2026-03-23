const mongoose = require("mongoose");
const {
  saveKnowledgeDocument,
  getKnowledgeDocumentsByProjectId,
  analyzeKnowledgeDocument,
  analyzeKnowledgeRepository,
  getSyncStatus,
  getSyncStatusById,
  getSyncHistory,
} = require("../services/knowledgebase.service");

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "document file is required (field name: document)",
      });
    }

    const { projectId } = req.body || {};
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Valid projectId is required",
      });
    }

    const data = await saveKnowledgeDocument({
      req,
      file: req.file,
      projectId,
    });

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to upload document",
      error: error.message,
    });
  }
};

const listDocumentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const docs = await getKnowledgeDocumentsByProjectId(projectId);
    return res.status(200).json({
      success: true,
      data: docs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch documents",
      error: error.message,
    });
  }
};

const analyzeDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doc id",
      });
    }

    const doc = await analyzeKnowledgeDocument(docId);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Document analyzed successfully (placeholder)",
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to analyze document",
      error: error.message,
    });
  }
};

const analyzeRepository = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { repoId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    // Validate repoId if provided
    if (repoId && !mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid repository id",
      });
    }

    const result = await analyzeKnowledgeRepository(projectId, repoId || null);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Return 202 Accepted for async operations (sync started in background)
    // Return 200 if sync was already running
    const statusCode = result.alreadyRunning ? 200 : 202;
    
    return res.status(statusCode).json({
      success: true,
      message: result.message,
      data: {
        syncId: result.syncId,
        status: result.status,
        alreadyRunning: result.alreadyRunning,
        repoId: result.repoId,
        identifier: result.identifier,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to start repository analysis",
      error: error.message,
    });
  }
};

/**
 * Get sync status for a project (latest sync)
 */
const getProjectSyncStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type = "codebase" } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const syncStatus = await getSyncStatus(projectId, type);
    
    if (!syncStatus) {
      return res.status(404).json({
        success: false,
        message: "No sync status found for this project",
      });
    }

    return res.status(200).json({
      success: true,
      data: syncStatus,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get sync status",
      error: error.message,
    });
  }
};

/**
 * Get sync status by sync ID
 */
const getSyncStatusByIdController = async (req, res) => {
  try {
    const { syncId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(syncId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sync id",
      });
    }

    const syncStatus = await getSyncStatusById(syncId);
    
    if (!syncStatus) {
      return res.status(404).json({
        success: false,
        message: "Sync status not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: syncStatus,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get sync status",
      error: error.message,
    });
  }
};

/**
 * Get sync history for a project
 */
const getProjectSyncHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 10 } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const history = await getSyncHistory(projectId, parseInt(limit, 10));

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get sync history",
      error: error.message,
    });
  }
};

module.exports = {
  uploadDocument,
  listDocumentsByProject,
  analyzeDocument,
  analyzeRepository,
  getProjectSyncStatus,
  getSyncStatusByIdController,
  getProjectSyncHistory,
};