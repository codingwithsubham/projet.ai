const express = require("express");
const subscriptionController = require("../controllers/subscription.controller");

const router = express.Router();

// Get current user's active subscriptions
router.get("/", subscriptionController.getSubscriptions);

// Get sidebar agents for current user
router.get("/sidebar", subscriptionController.getSidebarAgents);

// Get subscription history
router.get("/history", subscriptionController.getHistory);

// Get subscription stats
router.get("/stats", subscriptionController.getStats);

// Check if subscribed to a specific agent
router.get("/check/:slug", subscriptionController.checkSubscription);

// Subscribe to an agent
router.post("/:slug/subscribe", subscriptionController.subscribe);

// Unsubscribe from an agent
router.post("/:slug/unsubscribe", subscriptionController.unsubscribe);

module.exports = router;
