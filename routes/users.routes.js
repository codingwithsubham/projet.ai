const express = require("express");
const usersController = require("../controllers/users.controller");

const router = express.Router();

router.get("/", usersController.getAllUsers);
router.post("/", usersController.createUser);
router.put("/:id", usersController.updateUserById);
router.delete("/:id", usersController.deleteUserById);

module.exports = router;
