const express = require("express");
const activityLogController = require("../controllers/activityLog.controller");

const router = express.Router();

// Get activities with filters (user's own or all if admin)
router.get("/", activityLogController.getActivities);

// Get activities for a specific project
router.get("/project/:projectId", activityLogController.getProjectActivities);

// Get team activity summary (admin/PM only)
router.get("/project/:projectId/team", activityLogController.getTeamSummary);

// Get handoff context for a specific user in a project
router.get("/project/:projectId/handoff/:userId", activityLogController.getHandoffContext);

module.exports = router;
