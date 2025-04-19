// routes/securityRoutes.js

const express = require("express");
const router = express.Router();
const { getSecurityLogs, getAuditLogs, getAuditLogById } = require("../controllers/securityController");
const { authMiddleware } = require("../middlewares/authMiddleware"); // assumes you have authentication middleware

router.get("/security-logs", authMiddleware, getSecurityLogs);

// get audit-logs
router.get("/audit-logs", authMiddleware, getAuditLogs);

router.get("/audit-logs/:id", authMiddleware, getAuditLogById); // 👈 New route

module.exports = router;
