/**
 * Agent Registry - Single source of truth for all marketplace agents
 * 
 * To add a new agent:
 * 1. Build the agent pipeline in z-agents/
 * 2. Create backend service/controller/routes
 * 3. Create frontend page and route
 * 4. Add entry below with unique slug
 * 5. Restart server - auto-sync adds it to marketplace
 */

const AGENT_CATEGORIES = {
  COMMON: 'common',           // Available to all roles
  PRODUCTIVITY: 'productivity', // Documentation, reporting tools
  QUALITY: 'quality',         // Testing, QA tools
  ANALYTICS: 'analytics',     // Charts, metrics, dashboards
  EXPERIMENTAL: 'experimental' // Beta features
};

const AGENT_STATUS = {
  ACTIVE: 'active',
  COMING_SOON: 'coming-soon',
  DEPRECATED: 'deprecated',
  BETA: 'beta'
};

/**
 * Agent Registry Configuration
 * Each agent needs:
 * - slug: unique identifier (used in URLs and DB)
 * - name: display name
 * - description: what the agent does
 * - icon: emoji or icon class
 * - category: from AGENT_CATEGORIES
 * - route: frontend route path
 * - sidebarLabel: text shown in sidebar
 * - status: from AGENT_STATUS
 * - version: semver string
 * - requiredRoutes: backend routes this agent needs (for validation)
 */
const AGENT_REGISTRY = [
  {
    slug: 'doc-agent',
    name: 'Document Agent',
    description: 'Generate structured markdown documents from prompts using RAG-enhanced AI. Create specifications, reports, guides, and more with intelligent context retrieval.',
    icon: '📝',
    category: AGENT_CATEGORIES.COMMON,
    route: '/documents',
    sidebarLabel: 'Documents',
    status: AGENT_STATUS.ACTIVE,
    version: '1.0.0',
    features: [
      'RAG-powered content generation',
      'Multiple document types',
      'Project context awareness',
      'Markdown export'
    ]
  },
  {
    slug: 'ppt-agent',
    name: 'Presentation Agent',
    description: 'Create professional presentations with AI-generated content and layouts. Automatically builds slides with proper structure and visual hierarchy.',
    icon: '📊',
    category: AGENT_CATEGORIES.COMMON,
    route: '/presentations',
    sidebarLabel: 'Presentations',
    status: AGENT_STATUS.ACTIVE,
    version: '1.0.0',
    features: [
      'AI-powered slide generation',
      'Multiple layout templates',
      'PPTX export',
      'HTML preview'
    ]
  }
  // Future agents can be added here:
  // {
  //   slug: 'test-case-agent',
  //   name: 'Test Case Agent',
  //   description: 'Generate comprehensive test cases from requirements',
  //   icon: '🧪',
  //   category: AGENT_CATEGORIES.QUALITY,
  //   route: '/test-cases',
  //   sidebarLabel: 'Test Cases',
  //   status: AGENT_STATUS.COMING_SOON,
  //   version: '1.0.0',
  //   features: ['Requirement analysis', 'Test scenario generation', 'Coverage tracking']
  // }
];

/**
 * Get all registered agents
 */
const getAllAgents = () => AGENT_REGISTRY;

/**
 * Get agent by slug
 */
const getAgentBySlug = (slug) => AGENT_REGISTRY.find(a => a.slug === slug);

/**
 * Get agents by category
 */
const getAgentsByCategory = (category) => AGENT_REGISTRY.filter(a => a.category === category);

/**
 * Get active agents only
 */
const getActiveAgents = () => AGENT_REGISTRY.filter(a => a.status === AGENT_STATUS.ACTIVE);

module.exports = {
  AGENT_CATEGORIES,
  AGENT_STATUS,
  AGENT_REGISTRY,
  getAllAgents,
  getAgentBySlug,
  getAgentsByCategory,
  getActiveAgents
};
