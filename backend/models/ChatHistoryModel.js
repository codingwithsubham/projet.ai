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

const ChatHistorySchema = new mongoose.Schema(
  {
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
      index: true,
    },
    chats: {
      type: [ChatMessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "chat_histories",
  }
);

module.exports = mongoose.model("ChatHistory", ChatHistorySchema);