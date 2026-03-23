/**
 * Repository Tags Configuration
 * 
 * Centralized configuration for repository categorization.
 * Used across backend services for multi-repo project support.
 */

/**
 * Available repository tag types
 */
const REPO_TAGS = {
  FRONTEND: "frontend",
  BACKEND: "backend",
  UI: "ui",
  DEVOPS: "devops",
  MOBILE: "mobile",
  SHARED: "shared",
  DOCS: "docs",
};

/**
 * Tag options with labels for UI display
 */
const REPO_TAG_OPTIONS = [
  { value: REPO_TAGS.FRONTEND, label: "Frontend" },
  { value: REPO_TAGS.BACKEND, label: "Backend" },
  { value: REPO_TAGS.UI, label: "UI" },
  { value: REPO_TAGS.DEVOPS, label: "DevOps" },
  { value: REPO_TAGS.MOBILE, label: "Mobile" },
  { value: REPO_TAGS.SHARED, label: "Shared" },
  { value: REPO_TAGS.DOCS, label: "Documentation" },
];

/**
 * Keyword patterns for automatic repository detection from user queries.
 * Each tag maps to an array of keywords that indicate the tag.
 * Keywords are matched case-insensitively against the query.
 */
const REPO_TAG_KEYWORDS = {
  [REPO_TAGS.FRONTEND]: [
    "frontend", "front-end", "react", "vue", "angular", "nextjs", "next.js",
    "client", "browser", "css", "scss", "tailwind", "component", "ui component",
    "web app", "webapp", "spa", "single page", "redux", "state management",
    "webpack", "vite", "html", "jsx", "tsx",
  ],
  [REPO_TAGS.BACKEND]: [
    "backend", "back-end", "server", "api", "rest", "graphql", "endpoint",
    "controller", "service", "middleware", "database", "db", "query",
    "express", "fastify", "nest", "node", "authentication", "auth",
    "routes", "model", "schema", "migration", "sql", "orm",
  ],
  [REPO_TAGS.MOBILE]: [
    "mobile", "ios", "android", "react native", "flutter", "expo",
    "app store", "play store", "native app", "mobile app",
    "swift", "kotlin", "xcode", "gradle",
  ],
  [REPO_TAGS.UI]: [
    "design system", "storybook", "figma", "button", "modal",
    "dropdown", "input", "form", "layout", "theme", "styling",
    "tokens", "primitives", "atoms", "molecules",
  ],
  [REPO_TAGS.DEVOPS]: [
    "devops", "ci/cd", "pipeline", "docker", "kubernetes", "k8s",
    "deployment", "deploy", "terraform", "aws", "azure", "gcp",
    "github actions", "jenkins", "infrastructure", "helm",
    "monitoring", "logging", "prometheus", "grafana",
  ],
  [REPO_TAGS.SHARED]: [
    "shared", "common", "utils", "utilities", "helper", "lib",
    "library", "package", "module", "types", "interfaces",
    "constants", "config", "core",
  ],
  [REPO_TAGS.DOCS]: [
    "docs", "documentation", "readme", "wiki", "guide", "tutorial",
    "markdown", "spec", "specification", "architecture",
    "adr", "rfc", "design doc",
  ],
};

/**
 * Get all valid tag values as an array
 * @returns {string[]}
 */
const getValidTags = () => Object.values(REPO_TAGS);

/**
 * Check if a tag value is valid
 * @param {string} tag 
 * @returns {boolean}
 */
const isValidTag = (tag) => getValidTags().includes(tag);

module.exports = {
  REPO_TAGS,
  REPO_TAG_OPTIONS,
  REPO_TAG_KEYWORDS,
  getValidTags,
  isValidTag,
};
