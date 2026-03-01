const express = require("express");
const chatController = require("../controllers/chat.controller");

const router = express.Router();

router.get("/:projectId/sessions", chatController.sessions);
router.post("/:projectId/sessions", chatController.createSession);
router.get("/:projectId/history", chatController.history);
router.post("/:projectId", chatController.chat);

module.exports = router;