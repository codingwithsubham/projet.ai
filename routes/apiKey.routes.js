const express = require("express");
const apiKeyController = require("../controllers/apiKey.controller");

const router = express.Router();

router.get("/", apiKeyController.getAllApiKeys);
router.post("/", apiKeyController.createApiKey);
router.put("/:id", apiKeyController.updateApiKeyById);
router.patch("/:id/revoke", apiKeyController.revokeApiKeyById);
router.post("/refresh-cache", apiKeyController.refreshApiKeyCache);

module.exports = router;