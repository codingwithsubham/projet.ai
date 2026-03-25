const express = require("express");
const presentationController = require("../controllers/presentation.controller");

const router = express.Router();

// Create a new presentation
router.post("/", presentationController.createPresentation);

// Get all presentations (with user-based filtering)
router.get("/", presentationController.getAllPresentations);

// Search presentations with filters
router.get("/search", presentationController.searchPresentations);

// Get a specific presentation
router.get("/:id", presentationController.getPresentationById);

// Download presentation as PPTX
router.get("/:id/download", presentationController.downloadPPTX);

// Delete a presentation
router.delete("/:id", presentationController.deletePresentation);

module.exports = router;
