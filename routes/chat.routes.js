const express = require("express");
const chatController = require("../controllers/chat.controller");

const router = express.Router();

router.get("/:projectId/sessions", chatController.sessions);
router.post("/:projectId/sessions", chatController.createSession);
router.delete("/:projectId/sessions/:sessionId", chatController.deleteSession);
router.get("/:projectId/history", chatController.history);
router.post("/:projectId", chatController.chatToDynamicAgent);

module.exports = router;