const express = require("express");
const projectController = require("../controllers/project.controller");

const router = express.Router();

router.post("/", projectController.createProject);
router.get("/", projectController.getAllProjects);
router.get("/:id", projectController.getProjectById);
router.put("/:id", projectController.updateProjectById);
router.patch("/:id/repo", projectController.saveProjectRepo);
router.patch("/:id/pat-token", projectController.saveProjectPatToken);
router.delete("/:id", projectController.deleteProjectById);

// Repository management routes
router.get("/:id/repositories", projectController.getRepositories);
router.post("/:id/repositories", projectController.addRepository);
router.get("/:id/repositories/:repoId", projectController.getRepository);
router.put("/:id/repositories/:repoId", projectController.updateRepository);
router.delete("/:id/repositories/:repoId", projectController.deleteRepository);

// Copilot configuration
router.get("/:id/copilot-config", projectController.getCopilotConfig);

// Board configuration
router.get("/:id/board-config", projectController.getBoardConfig);
router.patch("/:id/board-config", projectController.saveBoardConfig);

module.exports = router;