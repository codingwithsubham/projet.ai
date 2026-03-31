const Project = require("../models/ProjectModel");
const User = require("../models/UserModel");

const isAdminUser = (user) => String(user?.role || "") === "admin";

const getAssignedProjectIds = (user) => {
  if (!Array.isArray(user?.projects)) return [];
  return user.projects.map((id) => String(id));
};

const syncProjectOwner = async ({ projectId, newOwnerId, oldOwnerId }) => {
  if (oldOwnerId && String(oldOwnerId) !== String(newOwnerId || "")) {
    await User.findByIdAndUpdate(oldOwnerId, {
      $pull: { projects: projectId },
    });
  }

  if (newOwnerId) {
    await User.findByIdAndUpdate(newOwnerId, {
      $addToSet: { projects: projectId },
    });
  }
};

const createProject = async (payload) => {
  const project = await Project.create(payload);

  if (project.createdBy) {
    await User.findByIdAndUpdate(project.createdBy, {
      $addToSet: { projects: project._id },
    });
  }

  return project;
};

const getAllProjects = async (user) => {
  if (isAdminUser(user)) {
    return await Project.find().sort({ createdAt: -1 });
  }

  const assignedProjectIds = getAssignedProjectIds(user);
  if (!assignedProjectIds.length) return [];

  return await Project.find({ _id: { $in: assignedProjectIds } }).sort({ createdAt: -1 });
};

const getProjectById = async (id, user) => {
  // Internal flows (for example MCP) may not have an app user context.
  if (!user) {
    return await Project.findById(id);
  }

  if (isAdminUser(user)) {
    return await Project.findById(id);
  }

  const assignedProjectIds = getAssignedProjectIds(user);
  if (!assignedProjectIds.includes(String(id))) return null;

  return await Project.findById(id);
};

const updateProjectById = async (id, payload) => {
  const allowedFields = [
    "name",
    "description",
    "openapikey",
    "model",
    "repolink",
    "pat_token",
    "islangsmithEnabled",
    "langsmithapikey",
    "langsmithProject",
    "createdBy",
  ];

  const updateData = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      updateData[key] = payload[key];
    }
  }

  const existingProject = await Project.findById(id).select("createdBy");
  if (!existingProject) return null;

  const updatedProject = await Project.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!updatedProject) return null;

  if (Object.prototype.hasOwnProperty.call(updateData, "createdBy")) {
    await syncProjectOwner({
      projectId: updatedProject._id,
      oldOwnerId: existingProject.createdBy,
      newOwnerId: updatedProject.createdBy,
    });
  }

  return updatedProject;
};

const deleteProjectById = async (id) => {
  const deleted = await Project.findByIdAndDelete(id);

  if (deleted?._id) {
    await User.updateMany(
      { projects: deleted._id },
      { $pull: { projects: deleted._id } }
    );
  }

  return deleted;
};

const saveProjectRepoById = async (id, repolink) => {
  return await Project.findByIdAndUpdate(
    id,
    { repolink: String(repolink || "").trim() },
    { new: true, runValidators: true }
  );
};

const saveProjectPatTokenById = async (id, patToken) => {
  return await Project.findByIdAndUpdate(
    id,
    { pat_token: String(patToken || "").trim() },
    { new: true, runValidators: true }
  );
};

// ============ Repository Management Methods ============

/**
 * Add a repository to a project
 * @param {string} projectId - Project ID
 * @param {Object} repoData - Repository data { identifier, repolink, tag }
 * @returns {Promise<Object>} Updated project
 */
const addRepository = async (projectId, repoData) => {
  const { identifier, repolink, tag } = repoData;

  if (!identifier?.trim() || !repolink?.trim()) {
    throw new Error("Repository identifier and link are required");
  }

  const project = await Project.findById(projectId);
  if (!project) return null;

  // Check for duplicate identifier
  const existingRepo = project.repositories.find(
    (r) => r.identifier.toLowerCase() === identifier.trim().toLowerCase()
  );
  if (existingRepo) {
    throw new Error(`Repository with identifier "${identifier}" already exists`);
  }

  project.repositories.push({
    identifier: identifier.trim(),
    repolink: repolink.trim(),
    tag: tag || "backend",
  });

  await project.save();
  return project;
};

/**
 * Update a repository within a project
 * @param {string} projectId - Project ID
 * @param {string} repoId - Repository subdocument ID
 * @param {Object} repoData - Updated repository data
 * @returns {Promise<Object>} Updated project
 */
const updateRepository = async (projectId, repoId, repoData) => {
  const project = await Project.findById(projectId);
  if (!project) return null;

  const repo = project.repositories.id(repoId);
  if (!repo) {
    throw new Error("Repository not found");
  }

  // Check for duplicate identifier (excluding current repo)
  if (repoData.identifier) {
    const duplicate = project.repositories.find(
      (r) =>
        r._id.toString() !== repoId &&
        r.identifier.toLowerCase() === repoData.identifier.trim().toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Repository with identifier "${repoData.identifier}" already exists`);
    }
  }

  if (repoData.identifier) repo.identifier = repoData.identifier.trim();
  if (repoData.repolink) repo.repolink = repoData.repolink.trim();
  if (repoData.tag) repo.tag = repoData.tag;

  await project.save();
  return project;
};

/**
 * Delete a repository from a project
 * @param {string} projectId - Project ID
 * @param {string} repoId - Repository subdocument ID
 * @returns {Promise<Object>} Updated project
 */
const deleteRepository = async (projectId, repoId) => {
  const project = await Project.findById(projectId);
  if (!project) return null;

  const repo = project.repositories.id(repoId);
  if (!repo) {
    throw new Error("Repository not found");
  }

  project.repositories.pull(repoId);
  await project.save();
  return project;
};

/**
 * Get a specific repository by ID
 * @param {string} projectId - Project ID
 * @param {string} repoId - Repository subdocument ID
 * @returns {Promise<Object|null>} Repository object or null
 */
const getRepositoryById = async (projectId, repoId) => {
  const project = await Project.findById(projectId);
  if (!project) return null;

  const repo = project.repositories.id(repoId);
  return repo ? { ...repo.toObject(), pat_token: project.pat_token } : null;
};

/**
 * Get all repositories for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} List of repositories
 */
const getRepositoriesByProjectId = async (projectId) => {
  const project = await Project.findById(projectId).select("repositories");
  if (!project) return [];
  return project.repositories || [];
};

// ============ Board Configuration Methods ============

/**
 * Save or update the board configuration for a project
 * @param {string} projectId - Project ID
 * @param {Object} config - Board configuration
 * @param {string} config.platform - "github" | "jira" | "none"
 * @param {Object} [config.jira] - Jira-specific config
 * @returns {Promise<Object>} Updated project
 */
const saveBoardConfig = async (projectId, config) => {
  const project = await Project.findById(projectId);
  if (!project) return null;

  const { platform, jira } = config;

  if (!["github", "jira", "none"].includes(platform)) {
    throw new Error("Invalid platform. Must be 'github', 'jira', or 'none'.");
  }

  const boardConfig = { platform };

  if (platform === "jira") {
    if (!jira?.baseUrl?.trim() || !jira?.email?.trim() || !jira?.apiToken?.trim() || !jira?.projectKey?.trim()) {
      throw new Error("Jira configuration requires baseUrl, email, apiToken, and projectKey.");
    }
    boardConfig.jira = {
      baseUrl: jira.baseUrl.trim().replace(/\/+$/, ""),
      email: jira.email.trim(),
      apiToken: jira.apiToken.trim(),
      projectKey: jira.projectKey.trim().toUpperCase(),
      boardId: jira.boardId ? String(jira.boardId).trim() : "",
    };
  }

  project.boardConfig = boardConfig;
  await project.save();
  return project;
};

/**
 * Get board configuration for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object|null>} Board configuration
 */
const getBoardConfig = async (projectId) => {
  const project = await Project.findById(projectId).select("boardConfig pat_token");
  if (!project) return null;
  return project.boardConfig || { platform: "none" };
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProjectById,
  deleteProjectById,
  saveProjectRepoById,
  saveProjectPatTokenById,
  // Repository management
  addRepository,
  updateRepository,
  deleteRepository,
  getRepositoryById,
  getRepositoriesByProjectId,
  // Board configuration
  saveBoardConfig,
  getBoardConfig,
};