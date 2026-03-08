const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    openapikey: { type: String, required: true },
    model: { type: String, required: true },
    repolink: { type: String, trim: true, default: "" },
    pat_token: { type: String, trim: true, default: "" },
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