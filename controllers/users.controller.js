const mongoose = require("mongoose");
const usersService = require("../services/users.service");

const isAdmin = (user) => String(user?.role || "") === "admin";

const rejectForbidden = (res) => {
  return res.status(403).json({
    success: false,
    message: "Only admin users can manage users",
  });
};

const getAllUsers = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const users = await usersService.getAllUsers();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

const createUser = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const created = await usersService.createUser(req.body || {});
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: created,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to create user",
      error: error.message,
    });
  }
};

const updateUserById = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const updated = await usersService.updateUserById(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

const deleteUserById = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return rejectForbidden(res);

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    if (String(req.user?.id || req.user?._id || "") === String(id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const deleted = await usersService.deleteUserById(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUserById,
  deleteUserById,
};
