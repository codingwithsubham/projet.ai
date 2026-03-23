/**
 * Document Loaders
 * 
 * Utilities for loading and splitting documents from various sources.
 * Provides clean interfaces for web pages and GitHub repositories.
 */

const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { CheerioWebBaseLoader } = require("@langchain/community/document_loaders/web/cheerio");
const { GithubRepoLoader } = require("@langchain/community/document_loaders/web/github");

// Default text splitter configuration
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

// GitHub loader default ignore patterns
const DEFAULT_IGNORE_PATHS = [
  "node_modules",
  "dist",
  "build",
  ".git",
  "*.md",
  "*.lock",
  "package-lock.json",
  "yarn.lock",
  ".env",
  ".gitignore",
];

/**
 * Create a text splitter with default or custom options
 * @param {Object} [options]
 * @param {number} [options.chunkSize=1000] - Maximum chunk size
 * @param {number} [options.chunkOverlap=200] - Overlap between chunks
 * @returns {RecursiveCharacterTextSplitter}
 */
const createTextSplitter = (options = {}) => {
  return new RecursiveCharacterTextSplitter({
    chunkSize: options.chunkSize || DEFAULT_CHUNK_SIZE,
    chunkOverlap: options.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
  });
};

/**
 * Load and split a web document from URL
 * @param {string} url - Web page URL to load
 * @param {Object} [options]
 * @param {number} [options.chunkSize] - Chunk size for splitting
 * @param {number} [options.chunkOverlap] - Overlap between chunks
 * @returns {Promise<Array<Document>>} Split documents
 */
const loadWebDocument = async (url, options = {}) => {
  console.log(`📄 Loading document from: ${url}`);
  
  const loader = new CheerioWebBaseLoader(url);
  const docs = await loader.load();
  
  const splitter = createTextSplitter(options);
  const splitDocs = await splitter.splitDocuments(docs);
  
  console.log(`✅ Loaded and split into ${splitDocs.length} chunks`);
  
  return splitDocs;
};

/**
 * Normalize a GitHub repository URL
 * @param {string} repoUrl - Repository URL or shorthand (e.g., "owner/repo")
 * @returns {string} Normalized URL
 */
const normalizeGithubUrl = (repoUrl) => {
  let url = repoUrl.trim();
  
  if (!url.startsWith("http")) {
    url = `https://github.com/${url}`;
  }
  
  return url.replace(/\.git$/, "").replace(/\/$/, "");
};

/**
 * Load and split a GitHub repository
 * @param {Object} options
 * @param {string} options.repoUrl - Repository URL
 * @param {string} [options.patToken] - Personal access token
 * @param {string} [options.branch="main"] - Branch to load
 * @param {string[]} [options.ignorePaths] - Paths to ignore
 * @param {number} [options.chunkSize=1000] - Chunk size for splitting
 * @param {number} [options.chunkOverlap=100] - Overlap between chunks
 * @returns {Promise<Array<Document>>} Split documents
 */
const loadGithubRepo = async ({
  repoUrl,
  patToken = null,
  branch = "main",
  ignorePaths = DEFAULT_IGNORE_PATHS,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = 100,
}) => {
  const normalizedUrl = normalizeGithubUrl(repoUrl);
  console.log(`📦 Loading repository: ${normalizedUrl}`);
  
  const loaderOptions = {
    branch,
    recursive: true,
    ignorePaths,
    unknown: "warn",
  };
  
  // Add access token if provided
  if (patToken?.trim()) {
    loaderOptions.accessToken = patToken.trim();
  } else if (process.env.GITHUB_TOKEN) {
    loaderOptions.accessToken = process.env.GITHUB_TOKEN;
  }
  
  const loader = new GithubRepoLoader(normalizedUrl, loaderOptions);
  const docs = await loader.load();
  
  console.log(`📄 Loaded ${docs.length} files from repository`);
  
  const splitter = createTextSplitter({ chunkSize, chunkOverlap });
  const splitDocs = await splitter.splitDocuments(docs);
  
  console.log(`✅ Split into ${splitDocs.length} chunks`);
  
  return splitDocs;
};

/**
 * Count unique files from documents
 * @param {Array<Document>} documents - Documents with source metadata
 * @returns {number} Number of unique files
 */
const countUniqueFiles = (documents) => {
  const sources = new Set(
    documents
      .map((d) => d.metadata?.source)
      .filter(Boolean)
  );
  return sources.size;
};

module.exports = {
  createTextSplitter,
  loadWebDocument,
  loadGithubRepo,
  normalizeGithubUrl,
  countUniqueFiles,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_IGNORE_PATHS,
};
