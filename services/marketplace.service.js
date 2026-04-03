const AgentModel = require("../models/AgentModel");
const { AGENT_REGISTRY, AGENT_STATUS } = require("../common/agent-registry");

/**
 * Marketplace Service
 * Handles agent registry operations and marketplace queries
 */
class MarketplaceService {
  
  /**
   * Sync agents from registry config to database
   * Called on server startup to ensure DB is up to date
   */
  async syncAgentsFromRegistry() {
    console.log("[MarketplaceService] Syncing agents from registry...");
    
    const results = {
      created: [],
      updated: [],
      skipped: []
    };

    for (const agentConfig of AGENT_REGISTRY) {
      try {
        const existing = await AgentModel.findOne({ slug: agentConfig.slug });
        
        if (!existing) {
          // Create new agent
          await AgentModel.create(agentConfig);
          results.created.push(agentConfig.slug);
        } else if (!existing.isOverridden) {
          // Update existing agent (unless manually overridden by admin)
          await AgentModel.updateOne(
            { slug: agentConfig.slug },
            { $set: agentConfig }
          );
          results.updated.push(agentConfig.slug);
        } else {
          results.skipped.push(agentConfig.slug);
        }
      } catch (error) {
        console.error(`[MarketplaceService] Error syncing agent ${agentConfig.slug}:`, error.message);
      }
    }

    console.log(`[MarketplaceService] Sync complete:`, results);
    return results;
  }

  /**
   * Get all agents available in the marketplace
   * @param {Object} filters - Optional filters (category, status)
   */
  async listAgents(filters = {}) {
    const query = {};
    
    if (filters.category) {
      query.category = filters.category;
    }
    
    if (filters.status) {
      query.status = filters.status;
    } else {
      // By default, exclude deprecated agents
      query.status = { $ne: AGENT_STATUS.DEPRECATED };
    }

    const agents = await AgentModel.find(query)
      .sort({ category: 1, name: 1 })
      .lean();

    return agents;
  }

  /**
   * Get a single agent by slug
   * @param {string} slug - Agent slug
   */
  async getAgentBySlug(slug) {
    const agent = await AgentModel.findOne({ slug }).lean();
    return agent;
  }

  /**
   * Get agents by category
   * @param {string} category - Category to filter by
   */
  async getAgentsByCategory(category) {
    return this.listAgents({ category });
  }

  /**
   * Update agent (admin only)
   * Sets isOverridden flag to prevent auto-sync from overwriting
   * @param {string} slug - Agent slug
   * @param {Object} updates - Fields to update
   */
  async updateAgent(slug, updates) {
    const agent = await AgentModel.findOneAndUpdate(
      { slug },
      { 
        $set: { 
          ...updates, 
          isOverridden: true 
        } 
      },
      { new: true }
    );
    return agent;
  }

  /**
   * Increment subscriber count
   * @param {string} slug - Agent slug
   * @param {number} delta - Amount to change (1 or -1)
   */
  async updateSubscriberCount(slug, delta) {
    await AgentModel.updateOne(
      { slug },
      { $inc: { subscriberCount: delta } }
    );
  }

  /**
   * Get marketplace statistics
   */
  async getStats() {
    const [totalAgents, activeAgents, categoryCounts] = await Promise.all([
      AgentModel.countDocuments(),
      AgentModel.countDocuments({ status: AGENT_STATUS.ACTIVE }),
      AgentModel.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ])
    ]);

    return {
      totalAgents,
      activeAgents,
      byCategory: categoryCounts.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {})
    };
  }
}

module.exports = new MarketplaceService();
