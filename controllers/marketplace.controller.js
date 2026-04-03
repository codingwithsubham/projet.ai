const marketplaceService = require("../services/marketplace.service");
const { AGENT_CATEGORIES, AGENT_STATUS } = require("../common/agent-registry");

/**
 * Marketplace Controller
 * Handles HTTP requests for marketplace operations
 */

/**
 * GET /api/marketplace/agents
 * List all available agents in the marketplace
 */
const listAgents = async (req, res) => {
  try {
    const { category, status } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.status = status;

    const agents = await marketplaceService.listAgents(filters);

    res.json({
      success: true,
      data: agents,
      meta: {
        total: agents.length,
        categories: Object.values(AGENT_CATEGORIES),
        statuses: Object.values(AGENT_STATUS)
      }
    });
  } catch (error) {
    console.error("[MarketplaceController] listAgents error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch agents"
    });
  }
};

/**
 * GET /api/marketplace/agents/:slug
 * Get a single agent by slug
 */
const getAgent = async (req, res) => {
  try {
    const { slug } = req.params;
    const agent = await marketplaceService.getAgentBySlug(slug);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found"
      });
    }

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error("[MarketplaceController] getAgent error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch agent"
    });
  }
};

/**
 * GET /api/marketplace/categories
 * List all agent categories
 */
const listCategories = async (req, res) => {
  try {
    res.json({
      success: true,
      data: Object.entries(AGENT_CATEGORIES).map(([key, value]) => ({
        key,
        value,
        label: key.charAt(0) + key.slice(1).toLowerCase()
      }))
    });
  } catch (error) {
    console.error("[MarketplaceController] listCategories error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories"
    });
  }
};

/**
 * GET /api/marketplace/stats
 * Get marketplace statistics (admin only)
 */
const getStats = async (req, res) => {
  try {
    const stats = await marketplaceService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("[MarketplaceController] getStats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch stats"
    });
  }
};

/**
 * PUT /api/marketplace/agents/:slug
 * Update an agent (admin only)
 */
const updateAgent = async (req, res) => {
  try {
    const { slug } = req.params;
    const updates = req.body;

    // Prevent slug changes
    delete updates.slug;

    const agent = await marketplaceService.updateAgent(slug, updates);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found"
      });
    }

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error("[MarketplaceController] updateAgent error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update agent"
    });
  }
};

module.exports = {
  listAgents,
  getAgent,
  listCategories,
  getStats,
  updateAgent
};
