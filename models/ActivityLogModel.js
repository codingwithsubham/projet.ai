const mongoose = require("mongoose");
const { USER_ROLES } = require("../common/user-roles");

const ACTIVITY_SOURCES = ["mcp", "web_chat"];

const ContextSchema = new mongoose.Schema(
  {
    currentFile: { type: String, default: null },
    workspace: { type: String, default: null },
    branch: { type: String, default: null },
    repoUrl: { type: String, default: null },
    selection: { type: String, default: null, maxlength: 1000 },
  },
  { _id: false }
);

const ActivityLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApiKey",
      default: null,
    },
    source: {
      type: String,
      enum: ACTIVITY_SOURCES,
      required: true,
      index: true,
    },
    agentType: {
      type: String,
      enum: [...USER_ROLES, "general"],
      default: "general",
    },
    prompt: {
      type: String,
      required: true,
    },
    promptSummary: {
      type: String,
      maxlength: 150,
      default: null,
    },
    response: {
      type: String,
      default: null,
    },
    responseTruncated: {
      type: Boolean,
      default: false,
    },
    context: {
      type: ContextSchema,
      default: () => ({}),
    },
    toolsUsed: {
      type: [String],
      default: [],
    },
    sessionId: {
      type: String,
      index: true,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["success", "error"],
      default: "success",
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "activity_logs",
    // 90-day TTL - auto-delete old activity logs
    expireAfterSeconds: 90 * 24 * 60 * 60,
  }
);

// Compound indexes for common queries
ActivityLogSchema.index({ projectId: 1, createdAt: -1 });
ActivityLogSchema.index({ userId: 1, projectId: 1, createdAt: -1 });
ActivityLogSchema.index({ projectId: 1, userId: 1, createdAt: -1 });

// TTL index on createdAt for auto-cleanup
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
module.exports.ACTIVITY_SOURCES = ACTIVITY_SOURCES;
