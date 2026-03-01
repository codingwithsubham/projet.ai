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

module.exports = router;