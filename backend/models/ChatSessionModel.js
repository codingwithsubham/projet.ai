const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: { type: String, required: true },
  },
  { timestamps: true, _id: true }
);

const ChatSessionSchema = new mongoose.Schema(
  {
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
      trim: true,
      maxlength: 120,
    },
    chats: {
      type: [ChatMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "chat_sessions",
  }
);

module.exports = mongoose.model("ChatSession", ChatSessionSchema);