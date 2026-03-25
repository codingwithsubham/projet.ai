const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    prompt: { type: String, required: true },
    description: { type: String, default: "" },
    statusMessage: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    content: { type: String, default: "" }, // Full markdown content (single field)
    status: {
      type: String,
      enum: ["draft", "completed", "error", "published"],
      default: "draft",
    },
    generationTime: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
    // Publishing fields
    publishedAt: { type: Date, default: null },
    publishedDocId: { type: mongoose.Schema.Types.ObjectId, ref: "Doc", default: null },
  },
  {
    timestamps: true,
    collection: "documents",
  }
);

module.exports = mongoose.model("Document", DocumentSchema);
