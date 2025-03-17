const express = require("express");
const { registerUser } = require("../controllers/authController");
const { loginUser } = require("../controllers/authController"); // Ensure correct path
const router = express.Router();

// Register endpoint
router.post("/register", registerUser);

//Login endpoint
router.post("/login", loginUser);
module.exports = router;
