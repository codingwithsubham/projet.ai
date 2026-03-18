const mongoose = require("mongoose");
const chatService = require("../services/chat.service");

const chatToDynamicAgent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message, sessionId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: "message is required" });
    }

    const data = await chatService.sendChatMessageToDynamicAgent({
      projectId,
      message,
      sessionId,
      requester: req.user,
    });

    if (!data) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Chat response generated",
      data,
    });
  } catch (error) {
    console.log("Error in chatToDynamicAgent:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process chat",
      error: error.message,
    });
  }
};

const history = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { sessionId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const data = await chatService.getChatHistory(projectId, sessionId, req.user);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat history",
      error: error.message,
    });
  }
};

const sessions = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const data = await chatService.getChatSessions(projectId, req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat sessions",
      error: error.message,
    });
  }
};

const createSession = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const data = await chatService.createChatSession(projectId, title || "New Chat", "general", req.user);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create chat session",
      error: error.message,
    });
  }
};

const deleteSession = async (req, res) => {
  try {
    const { projectId, sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid session id" });
    }

    const deleted = await chatService.deleteChatSession(projectId, sessionId, req.user);
    
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Chat session not found or unauthorized" });
    }

    return res.status(200).json({ success: true, message: "Chat session deleted" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete chat session",
      error: error.message,
    });
  }
};

module.exports = { chatToDynamicAgent, history, sessions, createSession, deleteSession };