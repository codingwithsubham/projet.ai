const subscriptionService = require("../services/subscription.service");

/**
 * Subscription Controller
 * Handles HTTP requests for subscription operations
 */

/**
 * POST /api/subscriptions/:slug/subscribe
 * Subscribe to an agent
 */
const subscribe = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.userId;

    const result = await subscriptionService.subscribe(userId, slug);

    res.json({
      success: true,
      message: `Successfully subscribed to ${result.agent.name}`,
      data: {
        subscription: result.subscription,
        agent: result.agent
      }
    });
  } catch (error) {
    console.error("[SubscriptionController] subscribe error:", error);
    
    const statusCode = error.message.includes('not found') ? 404 
      : error.message.includes('Already subscribed') ? 409 
      : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/subscriptions/:slug/unsubscribe
 * Unsubscribe from an agent
 */
const unsubscribe = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.userId;

    const result = await subscriptionService.unsubscribe(userId, slug);

    res.json({
      success: true,
      message: `Successfully unsubscribed from ${slug}`,
      data: result.subscription
    });
  } catch (error) {
    console.error("[SubscriptionController] unsubscribe error:", error);
    
    const statusCode = error.message.includes('No active subscription') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/subscriptions
 * Get current user's active subscriptions
 */
const getSubscriptions = async (req, res) => {
  try {
    const userId = req.userId;
    const subscriptions = await subscriptionService.getUserSubscriptions(userId);

    res.json({
      success: true,
      data: subscriptions,
      meta: {
        total: subscriptions.length
      }
    });
  } catch (error) {
    console.error("[SubscriptionController] getSubscriptions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscriptions"
    });
  }
};

/**
 * GET /api/subscriptions/history
 * Get user's full subscription history
 */
const getHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const history = await subscriptionService.getSubscriptionHistory(userId);

    res.json({
      success: true,
      data: history,
      meta: {
        total: history.length
      }
    });
  } catch (error) {
    console.error("[SubscriptionController] getHistory error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscription history"
    });
  }
};

/**
 * GET /api/subscriptions/sidebar
 * Get subscribed agents formatted for sidebar rendering
 */
const getSidebarAgents = async (req, res) => {
  try {
    const userId = req.userId;
    const agents = await subscriptionService.getSidebarAgents(userId);

    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error("[SubscriptionController] getSidebarAgents error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch sidebar agents"
    });
  }
};

/**
 * GET /api/subscriptions/check/:slug
 * Check if user is subscribed to a specific agent
 */
const checkSubscription = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.userId;

    const isSubscribed = await subscriptionService.isSubscribed(userId, slug);

    res.json({
      success: true,
      data: {
        agentSlug: slug,
        isSubscribed
      }
    });
  } catch (error) {
    console.error("[SubscriptionController] checkSubscription error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check subscription"
    });
  }
};

/**
 * GET /api/subscriptions/stats
 * Get user's subscription statistics
 */
const getStats = async (req, res) => {
  try {
    const userId = req.userId;
    const stats = await subscriptionService.getUserStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("[SubscriptionController] getStats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch stats"
    });
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  getSubscriptions,
  getHistory,
  getSidebarAgents,
  checkSubscription,
  getStats
};
