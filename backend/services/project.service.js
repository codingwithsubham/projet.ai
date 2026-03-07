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

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProjectById,
  deleteProjectById,
  saveProjectRepoById,
  saveProjectPatTokenById,
};