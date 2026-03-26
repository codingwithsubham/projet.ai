const express = require("express");
const mcpController = require("../controllers/mcp.controller");
const { authenticateMcpRequest } = require("../middlewares/mcp.middleware");

const router = express.Router();

router.use(authenticateMcpRequest);
router.get("/sse", mcpController.sseConnect);
router.post("/sse", mcpController.handleSseMessage);  // New MCP protocol posts to same endpoint
router.post("/messages", mcpController.handleMessage); // Legacy endpoint

module.exports = router;
