const mongoose = require("mongoose");
const apiKeyService = require("../services/apiKey.service");
const apiKeyCacheService = require("../services/apiKeyCache.service");

const isAdmin = (user) => String(user?.role || "") === "admin";

const rejectForbidden = (res) => {
  return res.status(403).json({
    success: false,
    message: "Only admin users can manage API keys",
  });
};

const getAllApiKeys = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const apiKeys = await apiKeyService.listApiKeys();
    return res.status(200).json({ success: true, data: apiKeys });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch API keys",
      error: error.message,
    });
  }
};

const createApiKey = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const created = await apiKeyService.createApiKey(req.body || {}, req.user);
    const cache = await apiKeyCacheService.refreshApiKeyCache();

    return res.status(201).json({
      success: true,
      message: "API key created successfully",
      data: created,
      cache,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to create API key",
      error: error.message,
    });
  }
};

const updateApiKeyById = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid API key id" });
    }

    const updated = await apiKeyService.updateApiKeyById(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, message: "API key not found" });
    }

    const cache = await apiKeyCacheService.refreshApiKeyCache();

    return res.status(200).json({
      success: true,
      message: "API key updated successfully",
      data: updated,
      cache,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to update API key",
      error: error.message,
    });
  }
};

const revokeApiKeyById = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid API key id" });
    }

    const updated = await apiKeyService.revokeApiKeyById(id);
    if (!updated) {
      return res.status(404).json({ success: false, message: "API key not found" });
    }

    const cache = await apiKeyCacheService.refreshApiKeyCache();

    return res.status(200).json({
      success: true,
      message: "API key revoked successfully",
      data: updated,
      cache,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to revoke API key",
      error: error.message,
    });
  }
};

const refreshApiKeyCache = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const cache = await apiKeyCacheService.refreshApiKeyCache();
    return res.status(200).json({
      success: true,
      message: "API key cache refreshed",
      data: cache,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to refresh API key cache",
      error: error.message,
    });
  }
};

module.exports = {
  getAllApiKeys,
  createApiKey,
  updateApiKeyById,
  revokeApiKeyById,
  refreshApiKeyCache,
};