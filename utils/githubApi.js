/**
 * GitHub REST API Client
 *
 * Shared utility for making authenticated GitHub API calls.
 * Used by sprint analytics tools and any future services
 * that need direct GitHub access outside the MCP subprocess.
 */

const GITHUB_API_BASE = "https://api.github.com";
const MAX_ERROR_BODY = 200;

/**
 * Make an authenticated GET request to the GitHub REST API.
 *
 * @param {string} patToken - GitHub personal access token
 * @param {string} path - API path (e.g., "/repos/owner/repo/milestones")
 * @param {Object} [options] - Additional fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
const githubFetch = async (patToken, path, options = {}) => {
  if (!patToken) throw new Error("GitHub PAT token is required.");

  const url = `${GITHUB_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `token ${patToken}`,
      Accept: "application/vnd.github.v3+json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, MAX_ERROR_BODY)}`);
  }
  return res.json();
};

/**
 * Parse owner and repo name from a GitHub URL.
 *
 * @param {string} repolink - GitHub repository URL
 * @returns {{ owner: string, repo: string } | null}
 */
const parseOwnerRepo = (repolink) => {
  if (!repolink) return null;
  const match = repolink.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
};

module.exports = {
  githubFetch,
  parseOwnerRepo,
};
