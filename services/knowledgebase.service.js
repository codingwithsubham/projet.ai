const Doc = require("../models/DocModel");
const projectService = require("./project.service");
const PUBLIC_BASE = "/public/uploads/knowledgebase";
const { generateAndStoreEmbeddings, syncCodebase } = require("../helpers/embaddingHelpers")

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

const analyzeKnowledgeRepository = async (projectId) => {
  const project = await projectService.getProjectById(projectId);
  if (!project) return null;

  const result = await syncCodebase({ projectId });

  if(!result.success) throw new Error("Failed to analyze repository");

  return {
    success: true,
    message: `Repository sync completed. Added: ${result.inserted}, Updated: ${result.updated}, Deleted: ${result.deleted}, Skipped: ${result.skipped}.`,
  };
};

module.exports = {
  saveKnowledgeDocument,
  getKnowledgeDocumentsByProjectId,
  analyzeKnowledgeDocument,
  analyzeKnowledgeRepository,
};
