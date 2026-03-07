const express = require("express");
const mcpController = require("../controllers/mcp.controller");
const { authenticateMcpRequest } = require("../middlewares/mcp.middleware");

const router = express.Router();

router.use(authenticateMcpRequest);
router.get("/sse", mcpController.sseConnect);
router.post("/messages", mcpController.handleMessage);

module.exports = router;
