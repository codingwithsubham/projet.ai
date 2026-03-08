const mongoose = require("mongoose");
const projectService = require("../services/project.service");

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

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProjectById,
  deleteProjectById,
  saveProjectRepo,
  saveProjectPatToken,
};