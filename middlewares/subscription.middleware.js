const subscriptionService = require("../services/subscription.service");

/**
 * Factory function to create a subscription check middleware
 * @param {string} agentSlug - The agent slug to check subscription for
 */
const requireSubscription = (agentSlug) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId || req.user?._id || req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      const isSubscribed = await subscriptionService.isSubscribed(userId, agentSlug);

      if (!isSubscribed) {
        return res.status(403).json({
          success: false,
          message: `Subscription required for '${agentSlug}'. Please subscribe from the marketplace.`,
          code: "SUBSCRIPTION_REQUIRED",
          agentSlug
        });
      }

      return next();
    } catch (error) {
      console.error("[SubscriptionMiddleware] Error checking subscription:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to verify subscription"
      });
    }
  };
};

/**
 * Dynamic subscription check based on route
 * Maps routes to agent slugs and checks subscription
 */
const ROUTE_TO_AGENT_MAP = {
  '/documents': 'doc-agent',
  '/presentations': 'ppt-agent'
};

const checkRouteSubscription = async (req, res, next) => {
  try {
    // Extract the base route
    const baseRoute = '/' + req.baseUrl.split('/').filter(Boolean).pop();
    const agentSlug = ROUTE_TO_AGENT_MAP[baseRoute];

    if (!agentSlug) {
      // No subscription required for this route
      return next();
    }

    const userId = req.userId || req.user?._id || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const isSubscribed = await subscriptionService.isSubscribed(userId, agentSlug);

    if (!isSubscribed) {
      return res.status(403).json({
        success: false,
        message: `Subscription required. Please subscribe to access this feature from the marketplace.`,
        code: "SUBSCRIPTION_REQUIRED",
        agentSlug
      });
    }

    return next();
  } catch (error) {
    console.error("[SubscriptionMiddleware] Error in checkRouteSubscription:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify subscription"
    });
  }
};

module.exports = {
  requireSubscription,
  checkRouteSubscription,
  ROUTE_TO_AGENT_MAP
};
