const express = require("express");
const { getAllUsers, getUserById, updateUser, deleteUser, getSecurityLogsByUser } = require("../controllers/userController");

// Create a new router
const router = express.Router();

// Get all users
router.get("/users", getAllUsers);

// Get single user
router.get("/users/:id", getUserById);

// Update user
router.put("/users/:id", updateUser);

// Delete user
router.delete("/users/:id", deleteUser);

//get user security logs
router.get("/security-logs/:userId", getSecurityLogsByUser)

// Export the router
module.exports = router;