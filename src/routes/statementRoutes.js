const express = require("express");
const router = express.Router();
const { createStatement, getStatements } = require("../controllers/statementsController");
const {authMiddleware} = require("../middlewares/authMiddleware");

// POST /statements - Generate a new statement
router.post("/statements", authMiddleware, createStatement);

// GET /statements - Retrieve statements
router.get("/statements", authMiddleware, getStatements);

module.exports = router;
