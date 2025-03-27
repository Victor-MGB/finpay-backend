const express = require("express");
const { getAllUsers, getUserById, updateUser, deleteUser, updateUserStatus } = require("../controllers/userController");
const {authMiddleware} = require("../middlewares/authMiddleware");
const authorization = require("../middlewares/roleMiddleware");

// Create a new router
const router = express.Router();

// Get all users
router.get("/users", getAllUsers);

// Get single user
router.get("/users/:id", authMiddleware, getUserById);

// Update user
router.put("/users/:id", authMiddleware, updateUser);

// Delete user
router.delete("/users/:id", deleteUser);

// Update user status
router.patch("/users/status", authorization, updateUserStatus);

// Export the router
module.exports = router;