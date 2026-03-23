/**
 * Repository Detection Helpers
 * 
 * Utilities for automatic repository detection and filtering based on query context.
 * Supports multi-repo projects by intelligently routing queries to relevant repositories.
 */

const { REPO_TAG_KEYWORDS, isValidTag } = require("../common/repo-tags");

/**
 * Detect relevant repository tags from query keywords
 * Scans the query for keywords associated with each repository tag
 * 
 * @param {string} query - User's query text
 * @returns {string[]} Array of matching repo tags (empty if no specific match)
 * 
 * @example
 * detectRepoTagsFromQuery("fix the login API endpoint")
 * // Returns: ["backend"] - matches "api", "endpoint"
 * 
 * @example
 * detectRepoTagsFromQuery("update the React component styling")
 * // Returns: ["frontend"] - matches "react", "component"
 */
const detectRepoTagsFromQuery = (query) => {
  if (!query || typeof query !== "string") return [];
  
  const normalizedQuery = query.toLowerCase();
  const matchedTags = [];
  
  for (const [tag, keywords] of Object.entries(REPO_TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword)) {
        if (!matchedTags.includes(tag)) {
          matchedTags.push(tag);
        }
        break; // Found a match for this tag, move to next tag
      }
    }
  }
  
  return matchedTags;
};

/**
 * Build metadata filter for vector queries based on repo detection
 * Automatically detects relevant repos from query if not explicitly specified
 * 
 * @param {Object} options
 * @param {string} options.query - User's query text
 * @param {string|null} options.repoId - Explicit repository ID filter
 * @param {string|null} options.repoTag - Explicit repository tag filter
 * @param {boolean} options.autoDetect - Enable auto-detection (default: true)
 * @param {Object[]} options.repositories - Project's repositories array
 * @returns {{ filter: Object, detectedTags: string[] }} Filter object and detected tags
 */
const buildRepoFilter = ({
  query,
  repoId = null,
  repoTag = null,
  autoDetect = true,
  repositories = [],
}) => {
  const filter = {};
  let detectedTags = [];

  // Explicit repoId takes highest priority
  if (repoId) {
    filter.repoId = repoId;
    return { filter, detectedTags };
  }

  // Explicit repoTag takes second priority
  if (repoTag && isValidTag(repoTag)) {
    filter.repoTag = repoTag;
    return { filter, detectedTags };
  }

  // Auto-detection for multi-repo projects
  if (autoDetect && repositories?.length > 1) {
    detectedTags = detectRepoTagsFromQuery(query);
    
    if (detectedTags.length === 1) {
      // Single tag detected - filter to that repo
      filter.repoTag = detectedTags[0];
    }
    // Multiple tags detected: let all repos be searched, rely on relevance scoring
    // The repo metadata in results will show which repo each result came from
  }

  return { filter, detectedTags };
};

/**
 * Find repository by identifier from project's repositories array
 * 
 * @param {Object[]} repositories - Project's repositories array
 * @param {string} identifier - Repository identifier to find
 * @returns {Object|null} Repository object or null if not found
 */
const findRepositoryByIdentifier = (repositories, identifier) => {
  if (!repositories?.length || !identifier) return null;
  return repositories.find((repo) => repo.identifier === identifier) || null;
};

/**
 * Find repository by ID from project's repositories array
 * 
 * @param {Object[]} repositories - Project's repositories array
 * @param {string} repoId - Repository ID to find
 * @returns {Object|null} Repository object or null if not found
 */
const findRepositoryById = (repositories, repoId) => {
  if (!repositories?.length || !repoId) return null;
  return repositories.find((repo) => String(repo._id) === String(repoId)) || null;
};

/**
 * Get repositories filtered by tag
 * 
 * @param {Object[]} repositories - Project's repositories array
 * @param {string} tag - Tag to filter by
 * @returns {Object[]} Filtered repositories
 */
const getRepositoriesByTag = (repositories, tag) => {
  if (!repositories?.length || !tag) return [];
  return repositories.filter((repo) => repo.tag === tag);
};

/**
 * Check if project has multiple repositories configured
 * 
 * @param {Object} project - Project object
 * @returns {boolean}
 */
const isMultiRepoProject = (project) => {
  return project?.repositories?.length > 1;
};

/**
 * Get primary repository for a project
 * Returns first repository if multi-repo, or constructs from legacy repolink
 * 
 * @param {Object} project - Project object
 * @returns {Object|null} Primary repository or null
 */
const getPrimaryRepository = (project) => {
  if (!project) return null;
  
  // Multi-repo: return first repository
  if (project.repositories?.length > 0) {
    return project.repositories[0];
  }
  
  // Legacy: construct from repolink
  if (project.repolink) {
    return {
      identifier: "default",
      repolink: project.repolink,
      tag: "backend",
    };
  }
  
  return null;
};

module.exports = {
  detectRepoTagsFromQuery,
  buildRepoFilter,
  findRepositoryByIdentifier,
  findRepositoryById,
  getRepositoriesByTag,
  isMultiRepoProject,
  getPrimaryRepository,
};
