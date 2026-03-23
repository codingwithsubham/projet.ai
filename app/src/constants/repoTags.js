/**
 * Repository tag options for categorizing repositories within a project
 */
export const REPO_TAGS = {
  FRONTEND: "frontend",
  BACKEND: "backend",
  UI: "ui",
  DEVOPS: "devops",
  MOBILE: "mobile",
  SHARED: "shared",
  DOCS: "docs",
};

export const REPO_TAG_OPTIONS = [
  { value: REPO_TAGS.FRONTEND, label: "Frontend" },
  { value: REPO_TAGS.BACKEND, label: "Backend" },
  { value: REPO_TAGS.UI, label: "UI" },
  { value: REPO_TAGS.DEVOPS, label: "DevOps" },
  { value: REPO_TAGS.MOBILE, label: "Mobile" },
  { value: REPO_TAGS.SHARED, label: "Shared" },
  { value: REPO_TAGS.DOCS, label: "Documentation" },
];
