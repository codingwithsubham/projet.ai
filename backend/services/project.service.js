const Project = require("../models/ProjectModel");

const createProject = async (payload) => {
  return await Project.create(payload);
};

const getAllProjects = async () => {
  return await Project.find().sort({ createdAt: -1 });
};

const getProjectById = async (id) => {
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

  return await Project.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
};

const deleteProjectById = async (id) => {
  return await Project.findByIdAndDelete(id);
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

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProjectById,
  deleteProjectById,
  saveProjectRepoById,
  saveProjectPatTokenById,
};