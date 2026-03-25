const Document = require("../models/DocumentModel");

const createDocument = async (payload) => {
  return await Document.create(payload);
};

const getAllDocuments = async (user) => {
  if (!user) return [];

  if (String(user.role) !== "PM" && String(user.role) !== "admin") return [];

  if (String(user.role) === "admin") {
    return await Document.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
  }

  return await Document.find({ createdBy: user.id }).sort({ createdAt: -1 });
};

const getDocumentById = async (id, user) => {
  const document = await Document.findById(id).populate("createdBy", "name email");

  if (!document) return null;

  if (
    String(user.id) !== String(document.createdBy._id) &&
    String(user.role) !== "admin"
  ) {
    return null;
  }

  return document;
};

const updateDocumentStatus = async (id, status, errorMessage = "") => {
  const updateData = { status };
  if (errorMessage) updateData.errorMessage = errorMessage;
  return await Document.findByIdAndUpdate(id, updateData, { new: true });
};

const updateDocumentProgress = async (id, statusMessage) => {
  return await Document.findByIdAndUpdate(id, { statusMessage }, { new: true });
};

const appendDocumentContent = async (id, newContent) => {
  const document = await Document.findById(id);
  if (!document) return null;
  const updated = (document.content || "") + newContent;
  return await Document.findByIdAndUpdate(id, { content: updated }, { new: true });
};

const completeDocumentGeneration = async (id, generationTime = 0) => {
  return await Document.findByIdAndUpdate(
    id,
    { status: "completed", statusMessage: "Generation completed", generationTime },
    { new: true }
  );
};

const searchDocuments = async (user, searchTerm, filters = {}) => {
  if (!user || (String(user.role) !== "PM" && String(user.role) !== "admin")) return [];

  const query = {};

  if (String(user.role) !== "admin") query.createdBy = user._id;

  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: "i" } },
      { description: { $regex: searchTerm, $options: "i" } },
    ];
  }

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }

  return await Document.find(query)
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 });
};

const deleteDocumentById = async (id, user) => {
  const document = await Document.findById(id);

  if (!document) return { success: false, message: "Document not found" };

  if (
    String(user.id) !== String(document.createdBy) &&
    String(user.role) !== "admin"
  ) {
    return { success: false, message: "Unauthorized to delete this document" };
  }

  await Document.findByIdAndDelete(id);
  return { success: true, message: "Document deleted successfully" };
};

/**
 * Update document content (for editing)
 */
const updateDocumentContent = async (id, content, user) => {
  const document = await Document.findById(id);

  if (!document) return { success: false, message: "Document not found" };

  if (
    String(user.id) !== String(document.createdBy) &&
    String(user.role) !== "admin"
  ) {
    return { success: false, message: "Unauthorized to edit this document" };
  }

  document.content = content;
  await document.save();

  return { success: true, data: document, message: "Document updated successfully" };
};

/**
 * Mark document as published
 */
const markDocumentPublished = async (id, publishedDocId, user) => {
  const document = await Document.findById(id);

  if (!document) return { success: false, message: "Document not found" };

  if (
    String(user.id) !== String(document.createdBy) &&
    String(user.role) !== "admin"
  ) {
    return { success: false, message: "Unauthorized" };
  }

  document.status = "published";
  document.publishedAt = new Date();
  document.publishedDocId = publishedDocId;
  await document.save();

  return { success: true, data: document, message: "Document published" };
};

module.exports = {
  createDocument,
  getAllDocuments,
  getDocumentById,
  updateDocumentStatus,
  updateDocumentProgress,
  appendDocumentContent,
  completeDocumentGeneration,
  searchDocuments,
  deleteDocumentById,
  updateDocumentContent,
  markDocumentPublished,
};
