const mongoose = require("mongoose");

const DocSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    isAnalysized: { type: Boolean, default: false },
    fileurl: { type: String, required: true },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "docs",
  }
);

module.exports = mongoose.model("Doc", DocSchema);