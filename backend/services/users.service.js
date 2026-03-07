const mongoose = require("mongoose");
const User = require("../models/UserModel");
const Project = require("../models/ProjectModel");
const { USER_ROLES } = require("../common/user-roles");

const sanitizeUser = (user) => {
  const normalized = typeof user.toObject === "function" ? user.toObject() : user;
  const { password, ...safeUser } = normalized;
  return safeUser;
};

const normalizeString = (value) => String(value || "").trim();

const normalizeEmailOrUsername = (value) => normalizeString(value).toLowerCase();

const normalizeRole = (value) => normalizeString(value);

const normalizeProjectIds = (projects) => {
  if (!Array.isArray(projects)) return [];

  const ids = projects
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => mongoose.Types.ObjectId.isValid(value));

  return [...new Set(ids)];
};

const validateRole = (role) => {
  if (!USER_ROLES.includes(role)) {
    throw new Error(`role must be one of: ${USER_ROLES.join(", ")}`);
  }
};

const validateProjectIds = async (projectIds) => {
  if (!projectIds.length) return;
  const existing = await Project.countDocuments({ _id: { $in: projectIds } });
  if (existing !== projectIds.length) {
    throw new Error("One or more assigned projects are invalid");
  }
};

const getAllUsers = async () => {
  const users = await User.find().sort({ createdAt: -1 });
  return users.map((user) => sanitizeUser(user));
};

const createUser = async (payload) => {
  const name = normalizeString(payload.name);
  const username = normalizeEmailOrUsername(payload.username);
  const email = normalizeEmailOrUsername(payload.email);
  const password = normalizeString(payload.password);
  const role = normalizeRole(payload.role);
  const projects = normalizeProjectIds(payload.projects);

  if (!name) throw new Error("name is required");
  if (!username) throw new Error("username is required");
  if (!email) throw new Error("email is required");
  if (!password) throw new Error("password is required");
  if (!role) throw new Error("role is required");

  validateRole(role);
  await validateProjectIds(projects);

  const created = await User.create({
    name,
    username,
    email,
    password,
    role,
    projects,
  });

  return sanitizeUser(created);
};

const updateUserById = async (id, payload) => {
  const updateData = {};

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    updateData.name = normalizeString(payload.name);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "username")) {
    updateData.username = normalizeEmailOrUsername(payload.username);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    updateData.email = normalizeEmailOrUsername(payload.email);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "password")) {
    const password = normalizeString(payload.password);
    if (password) updateData.password = password;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "role")) {
    const role = normalizeRole(payload.role);
    if (!role) throw new Error("role is required");
    validateRole(role);
    updateData.role = role;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "projects")) {
    const projects = normalizeProjectIds(payload.projects);
    await validateProjectIds(projects);
    updateData.projects = projects;
  }

  if (!Object.keys(updateData).length) {
    throw new Error("No valid fields provided for update");
  }

  const updated = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  return updated ? sanitizeUser(updated) : null;
};

const deleteUserById = async (id) => {
  const deleted = await User.findByIdAndDelete(id);
  if (!deleted) return null;

  await Project.updateMany({ createdBy: deleted._id }, { $unset: { createdBy: "" } });

  return sanitizeUser(deleted);
};

module.exports = {
  getAllUsers,
  createUser,
  updateUserById,
  deleteUserById,
};
