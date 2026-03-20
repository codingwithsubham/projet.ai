const express = require("express");
const knowledgebaseController = require("../controllers/knowledgebase.controller");
const { uploadKnowledgeDocument } = require("../middlewares/upload.middleware");

const router = express.Router();

router.post("/documents", (req, res) => {
  uploadKnowledgeDocument(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Upload failed",
      });
    }
    return knowledgebaseController.uploadDocument(req, res);
  });
});

router.get("/documents/project/:projectId", knowledgebaseController.listDocumentsByProject);
router.post("/documents/:docId/analyze", knowledgebaseController.analyzeDocument);
router.post("/projects/:projectId/analyze-repo", knowledgebaseController.analyzeRepository);

// Sync status endpoints
router.get("/sync-status/project/:projectId", knowledgebaseController.getProjectSyncStatus);
router.get("/sync-status/:syncId", knowledgebaseController.getSyncStatusByIdController);
router.get("/sync-history/project/:projectId", knowledgebaseController.getProjectSyncHistory);

module.exports = router;