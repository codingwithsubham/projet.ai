const mongoose = require("mongoose");

const SlideSchema = new mongoose.Schema(
  {
    slideName: { type: String, required: true },
    slideNumber: { type: Number, required: true },
    slideType: { 
      type: String, 
      enum: ["cover", "content", "process", "info", "timeline", "conclusion"],
      default: "content"
    },
    content: { type: String, required: true }, // HTML with embedded CSS
    presenter_notes: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "slides",
  }
);

module.exports = mongoose.model("Slide", SlideSchema);
