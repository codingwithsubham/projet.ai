const ActivityLog = require("../models/ActivityLogModel");
const User = require("../models/UserModel");

const MAX_RESPONSE_LENGTH = 1000;
const MAX_SUMMARY_LENGTH = 150;

/**
 * Generate a short summary/topic from a prompt
 * Uses simple extraction - first sentence or truncation
 */
const generatePromptSummary = (prompt) => {
  if (!prompt) return null;
  
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  
  // Try to get first sentence
  const sentenceMatch = cleaned.match(/^[^.!?]*[.!?]/);
  if (sentenceMatch && sentenceMatch[0].length <= MAX_SUMMARY_LENGTH) {
    return sentenceMatch[0].trim();
  }
  
  // Truncate if too long
  if (cleaned.length <= MAX_SUMMARY_LENGTH) {
    return cleaned;
  }
  
  return cleaned.slice(0, MAX_SUMMARY_LENGTH - 3) + "...";
};

/**
 * Truncate response for storage
 */
const truncateResponse = (response) => {
  if (!response) return { text: null, truncated: false };
  
  const cleaned = response.trim();
  if (cleaned.length <= MAX_RESPONSE_LENGTH) {
    return { text: cleaned, truncated: false };
  }
  
  return {
    text: cleaned.slice(0, MAX_RESPONSE_LENGTH) + "...",
    truncated: true,
  };
};

/**
 * Log an activity (MCP or web chat interaction)
 */
const logActivity = async ({
  projectId,
  userId = null,
  apiKeyId = null,
  source,
  agentType = "general",
  prompt,
  response = null,
  context = {},
  toolsUsed = [],
  sessionId = null,
  duration = null,
  status = "success",
  errorMessage = null,
}) => {
  const { text: truncatedResponse, truncated } = truncateResponse(response);
  
  const activity = await ActivityLog.create({
    projectId,
    userId,
    apiKeyId,
    source,
    agentType,
    prompt,
    promptSummary: generatePromptSummary(prompt),
    response: truncatedResponse,
    responseTruncated: truncated,
    context,
    toolsUsed,
    sessionId,
    duration,
    status,
    errorMessage,
  });
  
  return activity;
};

/**
 * Get activities by user with pagination and filters
 */
const getActivitiesByUser = async (userId, projectId, options = {}) => {
  const {
    startDate,
    endDate,
    source,
    agentType,
    limit = 50,
    skip = 0,
  } = options;
  
  const query = { userId };
  
  if (projectId) {
    query.projectId = projectId;
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  if (source) query.source = source;
  if (agentType) query.agentType = agentType;
  
  const [activities, total] = await Promise.all([
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("projectId", "name")
      .lean(),
    ActivityLog.countDocuments(query),
  ]);
  
  return {
    activities: activities.map(serializeActivity),
    total,
    limit,
    skip,
  };
};

/**
 * Get all activities for a project with pagination and filters
 */
const getActivitiesByProject = async (projectId, options = {}) => {
  const {
    userId,
    startDate,
    endDate,
    source,
    agentType,
    limit = 50,
    skip = 0,
  } = options;
  
  const query = { projectId };
  
  if (userId) query.userId = userId;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  if (source) query.source = source;
  if (agentType) query.agentType = agentType;
  
  const [activities, total] = await Promise.all([
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email")
      .lean(),
    ActivityLog.countDocuments(query),
  ]);
  
  return {
    activities: activities.map(serializeActivity),
    total,
    limit,
    skip,
  };
};

/**
 * Get recent context for handoff - what a developer was working on
 */
const getHandoffContext = async (userId, projectId, days = 7) => {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const activities = await ActivityLog.find({
    userId,
    projectId,
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  
  // Extract unique topics/files
  const topics = new Set();
  const files = new Set();
  const recentPrompts = [];
  
  for (const activity of activities) {
    if (activity.promptSummary) {
      topics.add(activity.promptSummary);
    }
    if (activity.context?.currentFile) {
      files.add(activity.context.currentFile);
    }
    if (recentPrompts.length < 10) {
      recentPrompts.push({
        prompt: activity.prompt,
        summary: activity.promptSummary,
        agentType: activity.agentType,
        createdAt: activity.createdAt,
      });
    }
  }
  
  // Get user info
  const user = await User.findById(userId, "name email").lean();
  
  return {
    developer: user ? { name: user.name, email: user.email } : null,
    period: { days, since, until: new Date() },
    totalActivities: activities.length,
    topics: Array.from(topics).slice(0, 20),
    filesWorkedOn: Array.from(files).slice(0, 20),
    recentPrompts,
  };
};

/**
 * Get team activity summary for a project
 */
const getTeamActivitySummary = async (projectId, days = 7) => {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  // Aggregate by user
  const pipeline = [
    {
      $match: {
        projectId: projectId,
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: "$userId",
        totalActivities: { $sum: 1 },
        topics: { $addToSet: "$promptSummary" },
        agents: { $addToSet: "$agentType" },
        lastActivity: { $max: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: { path: "$user", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        userId: "$_id",
        userName: "$user.name",
        userEmail: "$user.email",
        totalActivities: 1,
        topics: { $slice: ["$topics", 10] },
        agents: 1,
        lastActivity: 1,
      },
    },
    {
      $sort: { lastActivity: -1 },
    },
  ];
  
  const summary = await ActivityLog.aggregate(pipeline);
  
  return {
    period: { days, since, until: new Date() },
    teamMembers: summary,
    totalTeamActivities: summary.reduce((acc, m) => acc + m.totalActivities, 0),
  };
};

/**
 * Get developer activity by name (for agent tools)
 */
const getDeveloperActivityByName = async (projectId, developerName, days = 7) => {
  // Find user by name (case-insensitive partial match)
  const user = await User.findOne({
    name: { $regex: developerName, $options: "i" },
  }).lean();
  
  if (!user) {
    return { error: `Developer "${developerName}" not found` };
  }
  
  return getHandoffContext(user._id, projectId, days);
};

/**
 * Serialize activity for API response
 */
const serializeActivity = (activity) => {
  return {
    id: String(activity._id),
    projectId: activity.projectId?._id 
      ? String(activity.projectId._id) 
      : String(activity.projectId),
    projectName: activity.projectId?.name || null,
    userId: activity.userId?._id
      ? String(activity.userId._id)
      : activity.userId 
        ? String(activity.userId)
        : null,
    userName: activity.userId?.name || null,
    userEmail: activity.userId?.email || null,
    source: activity.source,
    agentType: activity.agentType,
    prompt: activity.prompt,
    promptSummary: activity.promptSummary,
    response: activity.response,
    responseTruncated: activity.responseTruncated,
    context: activity.context,
    toolsUsed: activity.toolsUsed,
    sessionId: activity.sessionId,
    duration: activity.duration,
    status: activity.status,
    errorMessage: activity.errorMessage,
    createdAt: activity.createdAt,
  };
};

module.exports = {
  logActivity,
  getActivitiesByUser,
  getActivitiesByProject,
  getHandoffContext,
  getTeamActivitySummary,
  getDeveloperActivityByName,
  generatePromptSummary,
};
