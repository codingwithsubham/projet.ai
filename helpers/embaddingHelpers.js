const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { CheerioWebBaseLoader } = require("@langchain/community/document_loaders/web/cheerio");
const { GithubRepoLoader } = require("@langchain/community/document_loaders/web/github");
const { getPineconeIndex } = require("../config/pinecone");
const projectService = require("../services/project.service");
const SyncStatus = require("../models/SyncStatusModel");

/**
 * Load and split a web document from URL
 */
const loadWebDocument = async (url) => {
  console.log(`📄 Loading document from: ${url}`);
  
  const loader = new CheerioWebBaseLoader(url);
  const docs = await loader.load();
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  const splitDocs = await splitter.splitDocuments(docs);
  console.log(`✅ Split into ${splitDocs.length} chunks`);
  
  return splitDocs;
};

/**
 * Load and split a GitHub repository
 */
const loadGithubRepo = async (repoUrl, patToken, branch = "main") => {
  console.log(`📦 Loading repository: ${repoUrl}`);
  
  // Normalize repo URL
  let normalizedUrl = repoUrl.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://github.com/${normalizedUrl}`;
  }
  normalizedUrl = normalizedUrl.replace(/\.git$/, "").replace(/\/$/, "");
  
  const loaderOptions = {
    branch,
    recursive: true,
    ignorePaths: [
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
    ],
    unknown: "warn",
  };
  
  // Add access token if provided
  if (patToken && patToken.trim()) {
    loaderOptions.accessToken = patToken.trim();
  } else if (process.env.GITHUB_TOKEN) {
    loaderOptions.accessToken = process.env.GITHUB_TOKEN;
  }
  
  const loader = new GithubRepoLoader(normalizedUrl, loaderOptions);
  const docs = await loader.load();
  
  console.log(`📄 Loaded ${docs.length} files from repository`);
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });
  
  const splitDocs = await splitter.splitDocuments(docs);
  console.log(`✅ Split into ${splitDocs.length} chunks`);
  
  return splitDocs;
};

/**
 * Generate embeddings and store in Pinecone for a web document.
 * Uses source URL as unique identifier to prevent duplicates.
 */
const generateAndStoreEmbeddings = async ({ url, projectId }) => {
  console.log(`\n🚀 generateAndStoreEmbeddings started`);
  console.log(`   URL: ${url}`);
  console.log(`   Project ID: ${projectId}`);
  
  if (!url || !projectId) {
    throw new Error("url and projectId are required");
  }
  
  try {
    // 1. Load and split the document
    const splitDocs = await loadWebDocument(url);
    
    if (!splitDocs.length) {
      console.log("⚠️ No content found in document");
      return { success: true, inserted: 0, updated: 0, deleted: 0, skipped: 0 };
    }
    
    // 2. Add metadata to each chunk
    const docsWithMetadata = splitDocs.map((doc, idx) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        projectId: String(projectId),
        scope: "webpage",
        source: url,
        chunkIndex: idx,
      },
    }));
    
    // 3. Delete existing vectors for this URL (to handle updates)
    const index = getPineconeIndex();
    const namespace = `project-${projectId}`;
    
    try {
      // Delete by metadata filter - vectors with same source URL
      await index.namespace(namespace).deleteMany({
        filter: { source: { $eq: url } },
      });
      console.log(`🗑️ Deleted existing vectors for source: ${url}`);
    } catch (deleteErr) {
      // Ignore delete errors (might not exist)
      console.log(`ℹ️ No existing vectors to delete for: ${url}`);
    }
    
    const now = Date.now();
    const records = docsWithMetadata
      .map((doc, idx) => {
        const text = (doc.pageContent || "").trim();
        if (!text) {
          return null;
        }

        return {
          _id: `${projectId}-webpage-${idx}-${now}`,
          text,
          projectId: doc.metadata.projectId,
          scope: doc.metadata.scope,
          source: doc.metadata.source,
          chunkIndex: doc.metadata.chunkIndex,
        };
      })
      .filter(Boolean);

    console.log(`📤 Upserting ${records.length} records with Pinecone integrated embeddings...`);

    const BATCH_SIZE = 96; // Pinecone integrated embeddings limit
    const target = index.namespace(namespace);
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      if (!batch.length) {
        continue;
      }

      console.log(
        `   ⤴ Upserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)} - size=${batch.length}, firstId=${batch[0]?._id}`
      );
      await target.upsertRecords({ records: batch });
    }
    

    return {
      success: true,
      inserted: records.length,
      updated: 0,
      deleted: 0,
      skipped: docsWithMetadata.length - records.length,
    };
  } catch (err) {
    console.error("❌ generateAndStoreEmbeddings failed:", err);
    throw err;
  }
};

/**
 * Sync a GitHub codebase to Pinecone (synchronous version).
 * Uses file path as unique identifier for incremental updates.
 * @param {Object} options
 * @param {string} options.projectId - The project ID
 * @param {Object} [options.syncStatus] - Optional SyncStatus document to update progress
 */
const syncCodebase = async ({ projectId, syncStatus = null }) => {
  console.log(`\n🔄 syncCodebase started for project: ${projectId}`);
  
  if (!projectId) {
    throw new Error("projectId is required");
  }
  
  // Helper to update progress if syncStatus is provided
  const updateProgress = async (step, percentage) => {
    if (syncStatus) {
      try {
        await syncStatus.updateProgress(step, percentage);
      } catch (e) {
        console.warn("Failed to update sync progress:", e.message);
      }
    }
  };
  
  // 1. Get project details from DB
  const project = await projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  
  if (!project.repolink) {
    throw new Error("Project does not have a repository link configured");
  }
  
  console.log(`📦 Repository: ${project.repolink}`);
  console.log(`🔑 PAT Token: ${project.pat_token ? "configured" : "not configured"}`);
  
  await updateProgress("Loading repository from GitHub...", 5);
  
  try {
    // 2. Load and split the repository
    const splitDocs = await loadGithubRepo(
      project.repolink,
      project.pat_token,
      "main"
    );
    
    await updateProgress("Processing repository files...", 30);
    
    if (!splitDocs.length) {
      console.log("⚠️ No content found in repository");
      return { success: true, inserted: 0, updated: 0, deleted: 0, skipped: 0, totalFiles: 0, totalChunks: 0 };
    }
    
    // 3. Add metadata to each chunk
    const docsWithMetadata = splitDocs.map((doc, idx) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        projectId: String(projectId),
        scope: "codebase",
        chunkIndex: idx,
      },
    }));
    
    await updateProgress("Clearing existing vectors...", 40);
    
    // 4. Clear existing codebase vectors for this project (full sync)
    const index = getPineconeIndex();
    const namespace = `project-${projectId}`;
    
    try {
      await index.namespace(namespace).deleteMany({
        filter: { scope: { $eq: "codebase" } },
      });
      console.log(`🗑️ Cleared existing codebase vectors for project`);
    } catch (deleteErr) {
      console.log(`ℹ️ No existing codebase vectors to delete`);
    }
    
    await updateProgress("Preparing records for embedding...", 50);
    
    // 5. Upsert records using Pinecone integrated embeddings
    const now = Date.now();
    const records = docsWithMetadata
      .map((doc, idx) => {
        const text = (doc.pageContent || "").trim();
        if (!text) {
          return null;
        }

        return {
          _id: `${projectId}-codebase-${idx}-${now}`,
          text,
          projectId: doc.metadata.projectId,
          scope: doc.metadata.scope,
          source: doc.metadata.source || "",
          chunkIndex: doc.metadata.chunkIndex,
        };
      })
      .filter(Boolean);

    console.log(`📤 Upserting ${records.length} records with Pinecone integrated embeddings...`);

    const BATCH_SIZE = 96; // Pinecone integrated embeddings limit
    const target = index.namespace(namespace);
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      if (!batch.length) {
        console.log(`   ⚠️ Skipping empty batch at ${i}`);
        continue;
      }
      
      // Calculate progress: 50% base + up to 45% for batches (leaving 5% for completion)
      const batchProgress = 50 + Math.floor((batchNum / totalBatches) * 45);
      await updateProgress(`Embedding batch ${batchNum}/${totalBatches}...`, batchProgress);
      
      console.log(`   ⤴ Upserting batch ${batchNum}/${totalBatches} - size=${batch.length}, firstId=${batch[0]?._id}`);
      await target.upsertRecords({ records: batch });
      console.log(`   ✅ Upserted batch ${batchNum}/${totalBatches}`);
    }
    
    console.log(`✅ Stored ${records.length} records in Pinecone`);
    
    // Count unique files from source metadata
    const uniqueFiles = new Set(docsWithMetadata.map(d => d.metadata.source).filter(Boolean));
    
    return {
      success: true,
      inserted: records.length,
      updated: 0,
      deleted: 0,
      skipped: docsWithMetadata.length - records.length,
      totalFiles: uniqueFiles.size,
      totalChunks: records.length,
    };
  } catch (err) {
    console.error("❌ syncCodebase failed:", err);
    throw err;
  }
};

/**
 * Start async codebase sync - returns immediately with sync status ID.
 * The actual sync runs in the background.
 * @param {string} projectId - The project ID
 * @returns {Promise<{syncId: string, status: string, message: string}>}
 */
const syncCodebaseAsync = async (projectId) => {
  console.log(`\n🚀 syncCodebaseAsync initiated for project: ${projectId}`);
  
  if (!projectId) {
    throw new Error("projectId is required");
  }
  
  // Check if sync is already in progress
  const isInProgress = await SyncStatus.isSyncInProgress(projectId, "codebase");
  if (isInProgress) {
    const existingSync = await SyncStatus.getLatestByProject(projectId, "codebase");
    return {
      syncId: existingSync._id.toString(),
      status: existingSync.status,
      message: "A sync operation is already in progress for this project",
      alreadyRunning: true,
    };
  }
  
  // Validate project exists and has repo configured
  const project = await projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  
  if (!project.repolink) {
    throw new Error("Project does not have a repository link configured");
  }
  
  // Create sync status record
  const syncStatus = await SyncStatus.create({
    project_id: projectId,
    syncType: "codebase",
    status: "pending",
    description: `Syncing repository: ${project.repolink}`,
    repoInfo: {
      url: project.repolink,
      branch: "main",
    },
  });
  
  console.log(`📋 Created sync status: ${syncStatus._id}`);
  
  // Start the sync in the background (don't await)
  setImmediate(async () => {
    try {
      await syncStatus.markInProgress("Initializing sync...");
      
      const result = await syncCodebase({ projectId, syncStatus });
      
      await syncStatus.markCompleted({
        totalFiles: result.totalFiles || 0,
        totalChunks: result.totalChunks || 0,
        inserted: result.inserted,
        updated: result.updated,
        deleted: result.deleted,
        skipped: result.skipped,
      });
      
      console.log(`✅ Async sync completed for project: ${projectId}`);
    } catch (err) {
      console.error(`❌ Async sync failed for project: ${projectId}`, err);
      await syncStatus.markFailed(err);
    }
  });
  
  return {
    syncId: syncStatus._id.toString(),
    status: "pending",
    message: "Repository sync started. Use the sync status endpoint to track progress.",
    alreadyRunning: false,
  };
};

/**
 * Query vectors for RAG context
 */
const queryVectors = async ({ projectId, query, topK = 5 }) => {
  console.log(`\n🔍 queryVectors for project: ${projectId}`);
  console.log(`   Query: "${query.slice(0, 50)}..."`);
  
  const index = getPineconeIndex();
  const namespace = `project-${projectId}`;
  const response = await index.namespace(namespace).searchRecords({
    query: {
      inputs: { text: query },
      topK,
    },
    fields: ["text", "projectId", "scope", "source", "chunkIndex"],
  });
  
  const results = (response?.result?.hits || []).map((hit) => ({
    content: hit?.fields?.text || "",
    metadata: {
      projectId: hit?.fields?.projectId,
      scope: hit?.fields?.scope,
      source: hit?.fields?.source,
      chunkIndex: hit?.fields?.chunkIndex,
    },
    score: hit?.score,
  }));
  
  console.log(`✅ Found ${results.length} relevant chunks`);
  
  return results;
};

module.exports = {
  generateAndStoreEmbeddings,
  syncCodebase,
  syncCodebaseAsync,
  queryVectors,
};