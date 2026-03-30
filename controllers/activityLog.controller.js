const mongoose = require("mongoose");
const activityLogService = require("../services/activityLog.service");

/**
 * Get activities with filters
 * Admin sees all project activities
 * Regular users see their own activities within their projects
 */
const getActivities = async (req, res) => {
  try {
    const { projectId, userId, startDate, endDate, source, agentType, limit, skip } = req.query;
    const requester = req.user;

    // Validate projectId if provided
    if (projectId && !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    // Non-admin/PM users can only see their own activity
    const isAdmin = ["admin", "PM"].includes(requester?.role);
    const targetUserId = isAdmin && userId ? userId : requester?.id || requester?._id;

    if (!isAdmin && !targetUserId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const options = {
      startDate,
      endDate,
      source,
      agentType,
      limit: Math.min(parseInt(limit) || 50, 100),
      skip: parseInt(skip) || 0,
    };

    let result;
    if (projectId) {
      // If admin, get all project activities; otherwise filter by user
      if (isAdmin) {
        result = await activityLogService.getActivitiesByProject(projectId, {
          ...options,
          userId: userId || undefined,
        });
      } else {
        result = await activityLogService.getActivitiesByUser(targetUserId, projectId, options);
      }
    } else {
      // No project specified - get user's activities across all projects
      result = await activityLogService.getActivitiesByUser(targetUserId, null, options);
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in getActivities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
      error: error.message,
    });
  }
};

/**
 * Get activities for a specific project
 */
const getProjectActivities = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId, startDate, endDate, source, agentType, limit, skip } = req.query;
    const requester = req.user;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    const isAdmin = ["admin", "PM"].includes(requester?.role);

    const options = {
      userId: isAdmin ? userId : (requester?.id || requester?._id),
      startDate,
      endDate,
      source,
      agentType,
      limit: Math.min(parseInt(limit) || 50, 100),
      skip: parseInt(skip) || 0,
    };

    const result = await activityLogService.getActivitiesByProject(projectId, options);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in getProjectActivities:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch project activities",
      error: error.message,
    });
  }
};

/**
 * Get handoff context for a specific user
 * Used when taking over another developer's work
 */
const getHandoffContext = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { days } = req.query;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const context = await activityLogService.getHandoffContext(
      userId,
      projectId,
      parseInt(days) || 7
    );

    return res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error("Error in getHandoffContext:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch handoff context",
      error: error.message,
    });
  }
};

/**
 * Get team activity summary for a project
 * Admin/PM only
 */
const getTeamSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days } = req.query;
    const requester = req.user;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: "Invalid project id" });
    }

    // Only admin and PM can see team summary
    const allowedRoles = ["admin", "PM"];
    if (!allowedRoles.includes(requester?.role)) {
      return res.status(403).json({ 
        success: false, 
        message: "Only admin and PM roles can view team summary" 
      });
    }

    const summary = await activityLogService.getTeamActivitySummary(
      projectId,
      parseInt(days) || 7
    );

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error in getTeamSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch team summary",
      error: error.message,
    });
  }
};

module.exports = {
  getActivities,
  getProjectActivities,
  getHandoffContext,
  getTeamSummary,
};
