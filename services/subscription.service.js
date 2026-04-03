const { AgentSubscriptionModel, SUBSCRIPTION_STATUS, SUBSCRIPTION_ACTIONS } = require("../models/AgentSubscriptionModel");
const AgentModel = require("../models/AgentModel");
const marketplaceService = require("./marketplace.service");

/**
 * Subscription Service
 * Handles user agent subscriptions
 */
class SubscriptionService {

  /**
   * Subscribe a user to an agent
   * @param {string} userId - User's ObjectId
   * @param {string} agentSlug - Agent slug to subscribe to
   */
  async subscribe(userId, agentSlug) {
    // Verify agent exists
    const agent = await AgentModel.findOne({ slug: agentSlug });
    if (!agent) {
      throw new Error(`Agent '${agentSlug}' not found`);
    }

    if (agent.status === 'deprecated') {
      throw new Error(`Agent '${agentSlug}' is deprecated and cannot be subscribed to`);
    }

    // Check for existing subscription
    let subscription = await AgentSubscriptionModel.findOne({ userId, agentSlug });

    if (subscription) {
      if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
        throw new Error(`Already subscribed to '${agentSlug}'`);
      }

      // Reactivate subscription
      subscription.status = SUBSCRIPTION_STATUS.ACTIVE;
      subscription.subscribedAt = new Date();
      subscription.unsubscribedAt = null;
      subscription.history.push({
        action: SUBSCRIPTION_ACTIONS.SUBSCRIBE,
        timestamp: new Date(),
        metadata: { reactivation: true }
      });
      await subscription.save();
    } else {
      // Create new subscription
      subscription = await AgentSubscriptionModel.create({
        userId,
        agentSlug,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        subscribedAt: new Date(),
        history: [{
          action: SUBSCRIPTION_ACTIONS.SUBSCRIBE,
          timestamp: new Date()
        }]
      });
    }

    // Update subscriber count
    await marketplaceService.updateSubscriberCount(agentSlug, 1);

    return {
      success: true,
      subscription,
      agent
    };
  }

  /**
   * Unsubscribe a user from an agent
   * @param {string} userId - User's ObjectId
   * @param {string} agentSlug - Agent slug to unsubscribe from
   */
  async unsubscribe(userId, agentSlug) {
    const subscription = await AgentSubscriptionModel.findOne({ 
      userId, 
      agentSlug,
      status: SUBSCRIPTION_STATUS.ACTIVE 
    });

    if (!subscription) {
      throw new Error(`No active subscription found for '${agentSlug}'`);
    }

    subscription.status = SUBSCRIPTION_STATUS.UNSUBSCRIBED;
    subscription.unsubscribedAt = new Date();
    subscription.history.push({
      action: SUBSCRIPTION_ACTIONS.UNSUBSCRIBE,
      timestamp: new Date()
    });
    await subscription.save();

    // Update subscriber count
    await marketplaceService.updateSubscriberCount(agentSlug, -1);

    return {
      success: true,
      subscription
    };
  }

  /**
   * Get all active subscriptions for a user
   * @param {string} userId - User's ObjectId
   */
  async getUserSubscriptions(userId) {
    const subscriptions = await AgentSubscriptionModel.find({
      userId,
      status: SUBSCRIPTION_STATUS.ACTIVE
    }).sort({ subscribedAt: -1 });

    // Enrich with agent details
    const agentSlugs = subscriptions.map(s => s.agentSlug);
    const agents = await AgentModel.find({ slug: { $in: agentSlugs } }).lean();
    const agentMap = agents.reduce((acc, agent) => {
      acc[agent.slug] = agent;
      return acc;
    }, {});

    return subscriptions.map(sub => ({
      ...sub.toObject(),
      agent: agentMap[sub.agentSlug] || null
    }));
  }

  /**
   * Get subscription history for a user (all time)
   * @param {string} userId - User's ObjectId
   */
  async getSubscriptionHistory(userId) {
    const subscriptions = await AgentSubscriptionModel.find({ userId })
      .sort({ updatedAt: -1 });

    // Flatten history entries with agent info
    const history = [];
    
    for (const sub of subscriptions) {
      const agent = await AgentModel.findOne({ slug: sub.agentSlug }).lean();
      
      for (const entry of sub.history) {
        history.push({
          agentSlug: sub.agentSlug,
          agentName: agent?.name || sub.agentSlug,
          agentIcon: agent?.icon || '🤖',
          action: entry.action,
          timestamp: entry.timestamp,
          metadata: entry.metadata
        });
      }
    }

    // Sort by timestamp descending
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return history;
  }

  /**
   * Check if user is subscribed to a specific agent
   * @param {string} userId - User's ObjectId
   * @param {string} agentSlug - Agent slug
   */
  async isSubscribed(userId, agentSlug) {
    return AgentSubscriptionModel.isSubscribed(userId, agentSlug);
  }

  /**
   * Get sidebar data for subscribed agents
   * Returns only essential fields needed to render sidebar
   * @param {string} userId - User's ObjectId
   */
  async getSidebarAgents(userId) {
    const subscriptions = await AgentSubscriptionModel.find({
      userId,
      status: SUBSCRIPTION_STATUS.ACTIVE
    });

    const agentSlugs = subscriptions.map(s => s.agentSlug);
    
    const agents = await AgentModel.find({ 
      slug: { $in: agentSlugs },
      status: { $ne: 'deprecated' }
    })
    .select('slug name icon route sidebarLabel')
    .lean();

    return agents;
  }

  /**
   * Get subscription stats for a user
   * @param {string} userId - User's ObjectId
   */
  async getUserStats(userId) {
    const [activeCount, totalSubscriptions, totalUnsubscriptions] = await Promise.all([
      AgentSubscriptionModel.countDocuments({ userId, status: SUBSCRIPTION_STATUS.ACTIVE }),
      AgentSubscriptionModel.aggregate([
        { $match: { userId: userId } },
        { $unwind: '$history' },
        { $match: { 'history.action': SUBSCRIPTION_ACTIONS.SUBSCRIBE } },
        { $count: 'total' }
      ]),
      AgentSubscriptionModel.aggregate([
        { $match: { userId: userId } },
        { $unwind: '$history' },
        { $match: { 'history.action': SUBSCRIPTION_ACTIONS.UNSUBSCRIBE } },
        { $count: 'total' }
      ])
    ]);

    return {
      activeSubscriptions: activeCount,
      totalSubscriptions: totalSubscriptions[0]?.total || 0,
      totalUnsubscriptions: totalUnsubscriptions[0]?.total || 0
    };
  }
}

module.exports = new SubscriptionService();
