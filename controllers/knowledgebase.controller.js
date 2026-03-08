const mongoose = require("mongoose");
const {
  saveKnowledgeDocument,
  getKnowledgeDocumentsByProjectId,
  analyzeKnowledgeDocument,
  analyzeKnowledgeRepository,
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
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const result = await analyzeKnowledgeRepository(projectId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Repository analysis started",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to analyze repository",
      error: error.message,
    });
  }
};

module.exports = {
  uploadDocument,
  listDocumentsByProject,
  analyzeDocument,
  analyzeRepository,
};