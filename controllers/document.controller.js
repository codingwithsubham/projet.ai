const mongoose = require("mongoose");
const documentService = require("../services/document.service");
const projectService = require("../services/project.service");
const { processDocumentRequest } = require("../z-agents/docAgent");

const createDocument = async (req, res) => {
  try {
    const { name, prompt, projectId, description, contentProvided, providedContent } = req.body;
    const userId = req.user.id;

    if (!name || !prompt || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, prompt, projectId",
      });
    }

    // If contentProvided mode, providedContent is required
    if (contentProvided && !providedContent) {
      return res.status(400).json({
        success: false,
        message: "providedContent is required when contentProvided is true",
      });
    }

    if (String(req.user.role) !== "PM" && String(req.user.role) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only PM users can create documents",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project ID" });
    }

    const project = await projectService.getProjectById(projectId, req.user);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const document = await documentService.createDocument({
      name,
      prompt,
      description: description || "",
      createdBy: userId,
      projectId,
      status: "draft",
      statusMessage: "Starting document generation...",
    });

    // Start async document generation
    // If contentProvided=true, pass delegated mode to skip RAG
    processDocumentRequest({
      documentId: document._id,
      name,
      prompt,
      project,
      delegated: !!contentProvided,
      delegatedContent: providedContent || "",
    }).catch((error) => {
      console.error(`❌ Document ${document._id} error:`, error.message);
    });

    return res.status(200).json({
      success: true,
      message: "Generating",
      data: {
        documentId: document._id,
        name: document.name,
        status: document.status,
        statusMessage: document.statusMessage,
      },
    });
  } catch (error) {
    console.error("Create document error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create document",
      error: error.message,
    });
  }
};

const getAllDocuments = async (req, res) => {
  try {
    const documents = await documentService.getAllDocuments(req.user);
    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    console.error("Get documents error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch documents",
      error: error.message,
    });
  }
};

const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }

    const document = await documentService.getDocumentById(id, req.user);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    return res.status(200).json({ success: true, data: document });
  } catch (error) {
    console.error("Get document error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch document",
      error: error.message,
    });
  }
};

const searchDocuments = async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;
    const documents = await documentService.searchDocuments(req.user, search || "", {
      startDate,
      endDate,
    });
    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    console.error("Search documents error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search documents",
      error: error.message,
    });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }

    const result = await documentService.deleteDocumentById(id, req.user);

    if (!result.success) {
      return res.status(403).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete document error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error: error.message,
    });
  }
};

const updateDocumentContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }

    if (typeof content !== "string") {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const result = await documentService.updateDocumentContent(id, content, req.user);

    if (!result.success) {
      return res.status(403).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error("Update document error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update document",
      error: error.message,
    });
  }
};

const markDocumentPublished = async (req, res) => {
  try {
    const { id } = req.params;
    const { publishedDocId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid document ID" });
    }

    if (!publishedDocId || !mongoose.Types.ObjectId.isValid(publishedDocId)) {
      return res.status(400).json({ success: false, message: "Valid publishedDocId is required" });
    }

    const result = await documentService.markDocumentPublished(id, publishedDocId, req.user);

    if (!result.success) {
      return res.status(403).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error("Mark published error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark document as published",
      error: error.message,
    });
  }
};

module.exports = {
  createDocument,
  getAllDocuments,
  getDocumentById,
  searchDocuments,
  deleteDocument,
  updateDocumentContent,
  markDocumentPublished,
};
