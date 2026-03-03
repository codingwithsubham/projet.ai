const express = require("express");
const controller = require("../controllers/kilocodeOpenAI.controller");
const { requireKilocodeKey } = require("../middlewares/kilocodeAuth.middleware");

const router = express.Router();

router.get("/models", requireKilocodeKey, controller.listModels);
router.post("/chat/completions", requireKilocodeKey, controller.createChatCompletion);

module.exports = router;