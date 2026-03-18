const mongoose = require("mongoose");

const PresentationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    prompt: { type: String, required: true },
    numberOfPages: { type: Number, required: true, min: 1, max: 5 },
    description: { type: String, default: "" }, // User-provided description
    statusMessage: { type: String, default: "" }, // Progress: "Generating Slide 1", etc.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    slides: [{ type: mongoose.Schema.Types.ObjectId, ref: "Slide" }],
    status: {
      type: String,
      enum: ["draft", "completed", "error"],
      default: "draft",
    },
    generationTime: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "presentations",
  }
);

module.exports = mongoose.model("Presentation", PresentationSchema);
