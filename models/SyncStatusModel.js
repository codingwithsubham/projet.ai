const mongoose = require("mongoose");

/**
 * SyncStatus Model - Tracks repository/knowledge sync operations
 * Enables async sync operations with status polling from frontend
 */
const SyncStatusSchema = new mongoose.Schema(
  {
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    syncType: {
      type: String,
      enum: ["codebase", "webpage", "document"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "failed"],
      default: "pending",
    },
    description: {
      type: String,
      default: "",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    stats: {
      totalFiles: { type: Number, default: 0 },
      totalChunks: { type: Number, default: 0 },
      inserted: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      deleted: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    error: {
      message: { type: String, default: null },
      stack: { type: String, default: null },
    },
    progress: {
      currentStep: { type: String, default: "" },
      percentage: { type: Number, default: 0, min: 0, max: 100 },
    },
    repoInfo: {
      url: { type: String, default: "" },
      branch: { type: String, default: "main" },
    },
  },
  {
    timestamps: true,
    collection: "sync_statuses",
  }
);

// Indexes for efficient queries
SyncStatusSchema.index({ project_id: 1, syncType: 1, createdAt: -1 });
SyncStatusSchema.index({ status: 1, createdAt: -1 });

// Helper method to update progress
SyncStatusSchema.methods.updateProgress = async function (step, percentage) {
  this.progress.currentStep = step;
  this.progress.percentage = Math.min(100, Math.max(0, percentage));
  await this.save();
};

// Helper method to mark as in progress
SyncStatusSchema.methods.markInProgress = async function (step = "Starting...") {
  this.status = "in_progress";
  this.startedAt = new Date();
  this.progress.currentStep = step;
  this.progress.percentage = 0;
  await this.save();
};

// Helper method to mark as completed
SyncStatusSchema.methods.markCompleted = async function (stats) {
  this.status = "completed";
  this.completedAt = new Date();
  this.progress.percentage = 100;
  this.progress.currentStep = "Completed";
  if (stats) {
    this.stats = { ...this.stats.toObject(), ...stats };
  }
  await this.save();
};

// Helper method to mark as failed
SyncStatusSchema.methods.markFailed = async function (error) {
  this.status = "failed";
  this.completedAt = new Date();
  this.error = {
    message: error.message || String(error),
    stack: error.stack || null,
  };
  await this.save();
};

// Static method to get latest sync status for a project
SyncStatusSchema.statics.getLatestByProject = async function (projectId, syncType = "codebase") {
  return this.findOne({ project_id: projectId, syncType })
    .sort({ createdAt: -1 })
    .exec();
};

// Static method to check if sync is already in progress
SyncStatusSchema.statics.isSyncInProgress = async function (projectId, syncType = "codebase") {
  const activeSync = await this.findOne({
    project_id: projectId,
    syncType,
    status: { $in: ["pending", "in_progress"] },
  });
  return !!activeSync;
};

module.exports = mongoose.model("SyncStatus", SyncStatusSchema);
