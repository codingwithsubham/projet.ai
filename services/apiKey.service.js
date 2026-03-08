const crypto = require("crypto");
const mongoose = require("mongoose");
const ApiKey = require("../models/ApiKeyModel");
const Project = require("../models/ProjectModel");
const { USER_ROLES } = require("../common/user-roles");

const normalizeString = (value) => String(value || "").trim();

const hashApiKey = (value) => {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
};

const createRawApiKey = () => {
  return `ak_${crypto.randomBytes(24).toString("hex")}`;
};

const createKeyPreview = (keyValue) => {
  const raw = String(keyValue || "");
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
};

const resolveStatus = ({ revokedAt, expiresAt }) => {
  if (revokedAt) return "revoked";
  if (new Date(expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
};

const parseExpiry = (value) => {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new Error("expiresAt must be a valid date");
  }

  if (parsed.getTime() <= Date.now()) {
    throw new Error("expiresAt must be in the future");
  }

  return parsed;
};

const parseRole = (value) => {
  const role = normalizeString(value || "dev");
  if (!USER_ROLES.includes(role)) {
    throw new Error(`role must be one of: ${USER_ROLES.join(", ")}`);
  }
  return role;
};

const parseProjectId = async (value) => {
  const projectId = normalizeString(value);
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw new Error("projectId is invalid");
  }

  const exists = await Project.exists({ _id: projectId });
  if (!exists) {
    throw new Error("projectId does not exist");
  }

  return projectId;
};

const serializeApiKey = (apiKey) => {
  const data = typeof apiKey.toObject === "function" ? apiKey.toObject() : apiKey;

  const projectId = data.projectId?._id
    ? String(data.projectId._id)
    : data.projectId
      ? String(data.projectId)
      : "";

  const projectName = data.projectId?.name || "";

  return {
    ...data,
    projectId,
    projectName,
    status: resolveStatus(data),
  };
};

const listApiKeys = async () => {
  const keys = await ApiKey.find()
    .populate("projectId", "name")
    .sort({ createdAt: -1 });

  return keys.map((item) => serializeApiKey(item));
};

const createApiKey = async (payload = {}, actorUser = null) => {
  const name = normalizeString(payload.name);
  const role = parseRole(payload.role);
  const projectId = await parseProjectId(payload.projectId);
  const expiresAt = parseExpiry(payload.expiresAt);

  if (!name) {
    throw new Error("name is required");
  }

  const plainTextKey = createRawApiKey();

  const created = await ApiKey.create({
    name,
    role,
    projectId,
    expiresAt,
    keyHash: hashApiKey(plainTextKey),
    keyPreview: createKeyPreview(plainTextKey),
    createdBy: actorUser?.id || actorUser?._id || null,
  });

  const populated = await ApiKey.findById(created._id).populate("projectId", "name");

  return {
    apiKey: serializeApiKey(populated),
    plainTextKey,
  };
};

const updateApiKeyById = async (id, payload = {}) => {
  const updateData = {};

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    const name = normalizeString(payload.name);
    if (!name) throw new Error("name cannot be empty");
    updateData.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "role")) {
    updateData.role = parseRole(payload.role);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "projectId")) {
    updateData.projectId = await parseProjectId(payload.projectId);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "expiresAt")) {
    updateData.expiresAt = parseExpiry(payload.expiresAt);
  }

  if (!Object.keys(updateData).length) {
    throw new Error("No valid fields provided for update");
  }

  const updated = await ApiKey.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate("projectId", "name");

  return updated ? serializeApiKey(updated) : null;
};

const revokeApiKeyById = async (id) => {
  const updated = await ApiKey.findByIdAndUpdate(
    id,
    { revokedAt: new Date() },
    { new: true }
  ).populate("projectId", "name");

  return updated ? serializeApiKey(updated) : null;
};

const getActiveApiKeysForCache = async () => {
  const now = new Date();

  const rows = await ApiKey.find(
    {
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      name: 1,
      role: 1,
      projectId: 1,
      expiresAt: 1,
      keyHash: 1,
    }
  ).lean();

  return rows.map((row) => ({
    id: String(row._id),
    keyHash: row.keyHash,
    name: row.name,
    role: row.role,
    projectId: String(row.projectId),
    expiresAt: row.expiresAt,
  }));
};

module.exports = {
  hashApiKey,
  listApiKeys,
  createApiKey,
  updateApiKeyById,
  revokeApiKeyById,
  getActiveApiKeysForCache,
};