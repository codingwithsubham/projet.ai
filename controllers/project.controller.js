const mongoose = require("mongoose");
const projectService = require("../services/project.service");
const copilotConfigGenerator = require("../helpers/copilotConfigGenerator");

const createProject = async (req, res) => {
  try {
    const project = await projectService.createProject(req.body);
    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to create project",
      error: error.message,
    });
  }
};

const getAllProjects = async (req, res) => {
  try {
    const projects = await projectService.getAllProjects(req.user);
    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: error.message,
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const project = await projectService.getProjectById(id, req.user);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch project",
      error: error.message,
    });
  }
};

const updateProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const project = await projectService.updateProjectById(id, req.body);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to update project",
      error: error.message,
    });
  }
};

const deleteProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const project = await projectService.deleteProjectById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete project",
      error: error.message,
    });
  }
};

const saveProjectRepo = async (req, res) => {
  try {
    const { id } = req.params;
    const { repolink } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    if (!repolink || !String(repolink).trim()) {
      return res.status(400).json({ success: false, message: "repolink is required" });
    }

    const project = await projectService.saveProjectRepoById(id, repolink);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Repository link saved successfully",
      data: project,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to save repository link",
      error: error.message,
    });
  }
};

const saveProjectPatToken = async (req, res) => {
  try {
    const { id } = req.params;
    const { pat_token } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    if (!pat_token || !String(pat_token).trim()) {
      return res.status(400).json({ success: false, message: "pat_token is required" });
    }

    const project = await projectService.saveProjectPatTokenById(id, pat_token);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({
      success: true,
      message: "PAT token saved successfully",
      data: project,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to save PAT token",
      error: error.message,
    });
  }
};

// ============ Repository Management Endpoints ============

const getRepositories = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const repositories = await projectService.getRepositoriesByProjectId(id);
    return res.status(200).json({ success: true, data: repositories });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch repositories",
      error: error.message,
    });
  }
};

const addRepository = async (req, res) => {
  try {
    const { id } = req.params;
    const { identifier, repolink, tag } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    if (!identifier?.trim() || !repolink?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Repository identifier and link are required",
      });
    }

    const project = await projectService.addRepository(id, { identifier, repolink, tag });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(201).json({
      success: true,
      message: "Repository added successfully",
      data: project.repositories,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to add repository",
    });
  }
};

const updateRepository = async (req, res) => {
  try {
    const { id, repoId } = req.params;
    const { identifier, repolink, tag } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ success: false, message: "Invalid project or repository id" });
    }

    const project = await projectService.updateRepository(id, repoId, { identifier, repolink, tag });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Repository updated successfully",
      data: project.repositories,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update repository",
    });
  }
};

const deleteRepository = async (req, res) => {
  try {
    const { id, repoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ success: false, message: "Invalid project or repository id" });
    }

    const project = await projectService.deleteRepository(id, repoId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Repository deleted successfully",
      data: project.repositories,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to delete repository",
    });
  }
};

const getRepository = async (req, res) => {
  try {
    const { id, repoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ success: false, message: "Invalid project or repository id" });
    }

    const repository = await projectService.getRepositoryById(id, repoId);
    if (!repository) {
      return res.status(404).json({ success: false, message: "Repository not found" });
    }

    return res.status(200).json({ success: true, data: repository });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch repository",
      error: error.message,
    });
  }
};

// ============ Board Configuration Endpoints ============

const saveBoardConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { platform, jira } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    if (!platform) {
      return res.status(400).json({ success: false, message: "platform is required" });
    }

    const project = await projectService.saveBoardConfig(id, { platform, jira });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    // Mask the Jira API token before returning
    const boardConfig = project.boardConfig?.toObject ? project.boardConfig.toObject() : { ...project.boardConfig };
    if (boardConfig?.jira?.apiToken) {
      boardConfig.jira.apiToken = "••••••••";
    }

    return res.status(200).json({
      success: true,
      message: "Board configuration saved successfully",
      data: boardConfig,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to save board configuration",
    });
  }
};

const getBoardConfig = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const boardConfig = await projectService.getBoardConfig(id);
    if (!boardConfig) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    // Mask Jira API token
    const safeConfig = { ...boardConfig.toObject ? boardConfig.toObject() : boardConfig };
    if (safeConfig?.jira?.apiToken) {
      safeConfig.jira.apiToken = "••••••••";
    }

    return res.status(200).json({ success: true, data: safeConfig });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch board configuration",
      error: error.message,
    });
  }
};

/**
 * Generate Copilot configuration for a project
 * Returns copilot-instructions.md content and MCP config
 */
const getCopilotConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.query; // 'full', 'instructions', 'mcp'
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const project = await projectService.getProjectById(id, req.user);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const options = {
      apiKeyPreview: "YOUR_API_KEY",
      conventions: project.conventions || "",
    };

    let data;
    switch (format) {
      case "instructions":
        data = {
          content: copilotConfigGenerator.generateCopilotInstructions(project, options),
          filename: "copilot-instructions.md",
          path: ".github/copilot-instructions.md",
        };
        break;
      case "mcp":
        data = {
          mcpConfig: copilotConfigGenerator.generateMcpConfig(project, options.apiKeyPreview),
          vsCodeSettings: copilotConfigGenerator.generateVsCodeSettings(project, options.apiKeyPreview),
        };
        break;
      default:
        data = copilotConfigGenerator.generateConfigPackage(project, options);
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate Copilot config",
      error: error.message,
    });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProjectById,
  deleteProjectById,
  saveProjectRepo,
  saveProjectPatToken,
  // Repository management
  getRepositories,
  addRepository,
  updateRepository,
  deleteRepository,
  getRepository,
  // Copilot configuration
  getCopilotConfig,
  // Board configuration
  saveBoardConfig,
  getBoardConfig,
};