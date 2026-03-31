/**
 * Jira REST API Client
 *
 * Shared utility for making authenticated Jira API calls.
 * Used by sprint analytics tools and any future services
 * that need direct Jira access outside the MCP subprocess.
 */

const MAX_ERROR_BODY = 200;

/**
 * Make an authenticated GET request to the Jira REST API.
 *
 * @param {Object} boardConfig - Project boardConfig object
 * @param {string} path - API path (e.g., "/rest/agile/1.0/board/1/sprint")
 * @param {Object} [options] - Additional fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
const jiraFetch = async (boardConfig, path, options = {}) => {
  const { baseUrl, email, apiToken } = boardConfig.jira || {};
  if (!baseUrl || !email || !apiToken) {
    throw new Error("Jira configuration is incomplete (baseUrl, email, apiToken required).");
  }

  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira API ${res.status}: ${body.slice(0, MAX_ERROR_BODY)}`);
  }
  return res.json();
};

/**
 * Resolve the Jira board ID from config or auto-discover.
 *
 * @param {Object} boardConfig - Project boardConfig object
 * @returns {Promise<string>} Board ID
 */
const resolveBoardId = async (boardConfig) => {
  if (boardConfig.jira?.boardId) return boardConfig.jira.boardId;

  const projectKey = boardConfig.jira?.projectKey;
  if (!projectKey) throw new Error("No boardId or projectKey configured for Jira.");

  const data = await jiraFetch(
    boardConfig,
    `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`
  );
  const board = data.values?.[0];
  if (!board) throw new Error(`No Jira board found for project key: ${projectKey}`);
  return String(board.id);
};

module.exports = {
  jiraFetch,
  resolveBoardId,
};
