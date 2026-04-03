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
const marketplaceRoutes = require("./marketplace.routes");
const subscriptionRoutes = require("./subscription.routes");
const { authenticateRequest } = require("../middlewares/auth.middleware");
const { requireSubscription } = require("../middlewares/subscription.middleware");

// Register all routes here
router.use(authenticateRequest);
router.use("/projects", projectRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/knowledgebase", knowledgebaseRoutes);
router.use("/chats", chatRoutes);
router.use("/api-keys", apiKeyRoutes);
router.use("/presentations", requireSubscription('ppt-agent'), presentationRoutes);
router.use("/documents", requireSubscription('doc-agent'), documentRoutes);
router.use("/activity", activityLogRoutes);
router.use("/marketplace", marketplaceRoutes);
router.use("/subscriptions", subscriptionRoutes);

module.exports = router;
