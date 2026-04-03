const express = require("express");
const marketplaceController = require("../controllers/marketplace.controller");
const { requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

// Public routes (authenticated users)
router.get("/agents", marketplaceController.listAgents);
router.get("/agents/:slug", marketplaceController.getAgent);
router.get("/categories", marketplaceController.listCategories);

// Admin only routes
router.get("/stats", requireAdmin, marketplaceController.getStats);
router.put("/agents/:slug", requireAdmin, marketplaceController.updateAgent);

module.exports = router;
