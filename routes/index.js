const express = require("express");
const router = express.Router();

const projectRoutes = require("./project.routes");
const authRoutes = require("./auth.routes");
const usersRoutes = require("./users.routes");
const knowledgebaseRoutes = require("./knowledgebase.routes");
const chatRoutes = require("./chat.routes");
const apiKeyRoutes = require("./apiKey.routes");
const presentationRoutes = require("./presentation.routes");
const documentRoutes = require("./document.routes");
const activityLogRoutes = require("./activityLog.routes");
const { authenticateRequest } = require("../middlewares/auth.middleware");

// Register all routes here
router.use(authenticateRequest);
router.use("/projects", projectRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/knowledgebase", knowledgebaseRoutes);
router.use("/chats", chatRoutes);
router.use("/api-keys", apiKeyRoutes);
router.use("/presentations", presentationRoutes);
router.use("/documents", documentRoutes);
router.use("/activity", activityLogRoutes);

module.exports = router;
