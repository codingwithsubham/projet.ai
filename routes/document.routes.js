const express = require("express");
const documentController = require("../controllers/document.controller");

const router = express.Router();

router.post("/", documentController.createDocument);
router.get("/", documentController.getAllDocuments);
router.get("/search", documentController.searchDocuments);
router.get("/:id", documentController.getDocumentById);
router.delete("/:id", documentController.deleteDocument);

module.exports = router;
