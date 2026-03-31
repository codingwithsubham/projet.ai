/**
 * Repository Prompt Builder
 * 
 * Utilities for building repository-related sections in system prompts.
 * Supports both multi-repo and legacy single-repo configurations.
 */

/**
 * Parse GitHub owner and repo from a repository URL
 * 
 * @param {string} repolink - Repository URL
 * @returns {{ owner: string, repo: string } | null}
 */
const parseOwnerRepo = (repolink) => {
  const cleaned = String(repolink || "").replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (match) return { owner: match[1], repo: match[2] };
  return null;
};

/**
 * Format a single repository entry for system prompt
 * 
 * @param {Object} repo - Repository object
 * @param {string} repo.identifier - Repository identifier
 * @param {string} repo.repolink - Repository URL
 * @param {string} [repo.tag] - Repository tag
 * @returns {string} Formatted repository line
 */
const formatRepositoryLine = (repo) => {
  const tagLabel = repo.tag ? `[${repo.tag}]` : "";
  const ownerRepo = parseOwnerRepo(repo.repolink);
  const ownerInfo = ownerRepo ? ` (owner: ${ownerRepo.owner}, repo: ${ownerRepo.repo})` : "";
  return `  - ${repo.identifier} ${tagLabel}: ${repo.repolink}${ownerInfo}`;
};

/**
 * Build repository section for system prompt
 * Handles both multi-repo and legacy single-repo configurations
 * 
 * @param {Object} project - Project object
 * @returns {string[]} Array of prompt lines for repository section
 */
const buildRepositoryPromptSection = (project) => {
  const lines = [];

  // Multi-repo configuration
  if (project.repositories?.length > 0) {
    lines.push(
      "",
      "Project Repositories:"
    );
    
    project.repositories.forEach((repo) => {
      lines.push(formatRepositoryLine(repo));
    });
    
    lines.push(
      "",
      "When referencing code, identify which repository it belongs to based on the [identifier:tag] markers in the context.",
      "For GitHub operations, use the appropriate owner/repo from the relevant repository."
    );
    
    return lines;
  }

  // Legacy single-repo fallback
  if (project.repolink) {
    lines.push(`- Repository: ${project.repolink}`);
    const ownerRepo = parseOwnerRepo(project.repolink);
    if (ownerRepo) {
      lines.push(
        `- GitHub Owner: ${ownerRepo.owner}`,
        `- GitHub Repo: ${ownerRepo.repo}`,
      );
    }
    return lines;
  }

  // No repository configured
  lines.push("- Repository: No repository configured.");
  return lines;
};

/**
 * Get primary GitHub owner/repo for a project
 * Returns the first available from multi-repo or legacy config
 * 
 * @param {Object} project - Project object
 * @returns {{ owner: string, repo: string } | null}
 */
const getPrimaryGitHubInfo = (project) => {
  // Check multi-repo first
  if (project.repositories?.length > 0) {
    for (const repo of project.repositories) {
      const info = parseOwnerRepo(repo.repolink);
      if (info) return info;
    }
  }
  
  // Fallback to legacy
  return parseOwnerRepo(project.repolink);
};

/**
 * Get GitHub info for a specific repository by identifier
 * 
 * @param {Object} project - Project object
 * @param {string} identifier - Repository identifier
 * @returns {{ owner: string, repo: string } | null}
 */
const getGitHubInfoByIdentifier = (project, identifier) => {
  const repo = project.repositories?.find((r) => r.identifier === identifier);
  if (repo) {
    return parseOwnerRepo(repo.repolink);
  }
  return null;
};

/**
 * Build board/issue-tracker section for system prompt
 * Adds context about which board platform is configured (GitHub Issues or Jira)
 * 
 * @param {Object} project - Project object
 * @returns {string[]} Array of prompt lines for board section
 */
const buildBoardPromptSection = (project) => {
  const lines = [];
  const boardConfig = project.boardConfig;

  if (!boardConfig || boardConfig.platform === "none") {
    lines.push("", "Project Board: No board configured. Work items cannot be tracked via tools.");
    return lines;
  }

  if (boardConfig.platform === "jira") {
    lines.push(
      "",
      "Project Board: Jira",
      `- Jira Project Key: ${boardConfig.jira?.projectKey || "N/A"}`,
      `- Jira Base URL: ${boardConfig.jira?.baseUrl || "N/A"}`,
      "- Use Jira tools (jira_search_issues, jira_get_issue, jira_create_issue, etc.) for all board operations.",
      "- When creating issues, always set the project key to the value above.",
    );
    return lines;
  }

  // Default: GitHub Issues
  lines.push(
    "",
    "Project Board: GitHub Issues",
    "- Use GitHub issue tools (list_issues, search_issues, create_issue, etc.) for all board operations.",
  );

  const primaryInfo = getPrimaryGitHubInfo(project);
  if (primaryInfo) {
    lines.push(
      `- Primary GitHub Owner: ${primaryInfo.owner}`,
      `- Primary GitHub Repo: ${primaryInfo.repo}`,
    );
  }

  return lines;
};

module.exports = {
  parseOwnerRepo,
  formatRepositoryLine,
  buildRepositoryPromptSection,
  buildBoardPromptSection,
  getPrimaryGitHubInfo,
  getGitHubInfoByIdentifier,
};
