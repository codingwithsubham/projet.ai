const mongoose = require("mongoose");

/**
 * Schema for individual repository within a project
 */
const RepositorySchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, trim: true },
    repolink: { type: String, required: true, trim: true },
    tag: {
      type: String,
      enum: ["frontend", "backend", "ui", "devops", "mobile", "shared", "docs"],
      default: "backend",
    },
  },
  { _id: true, timestamps: true }
);

/**
 * Schema for project board configuration (Jira / GitHub Issues)
 */
const BoardConfigSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["github", "jira", "none"],
      default: "none",
    },
    jira: {
      baseUrl: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      apiToken: { type: String, trim: true, default: "" },
      projectKey: { type: String, trim: true, default: "" },
    },
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    openapikey: { type: String, required: true },
    model: { type: String, required: true },
    // Legacy single repo field - kept for backward compatibility
    repolink: { type: String, trim: true, default: "" },
    pat_token: { type: String, trim: true, default: "" },
    // New: Multiple repositories support
    repositories: { type: [RepositorySchema], default: [] },
    // New: Project board configuration (Jira / GitHub Issues)
    boardConfig: { type: BoardConfigSchema, default: () => ({ platform: "none" }) },
    islangsmithEnabled: { type: Boolean, default: false },
    langsmithapikey: { type: String },
    langsmithProject: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "projects", // <-- explicitly set your collection name here
  }
);

module.exports = mongoose.model("Project", ProjectSchema);