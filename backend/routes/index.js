const express = require("express");
const router = express.Router();

const projectRoutes = require("./project.routes");
const authRoutes = require("./auth.routes");
const knowledgebaseRoutes = require("./knowledgebase.routes");
const chatRoutes = require("./chat.routes");

// Register all routes here
router.use("/projects", projectRoutes);
router.use("/auth", authRoutes);
router.use("/knowledgebase", knowledgebaseRoutes);
router.use("/chats", chatRoutes);

module.exports = router;
