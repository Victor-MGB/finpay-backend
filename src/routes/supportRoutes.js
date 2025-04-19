const express = require("express");
const router = express.Router();
const { createSupportTicket, getSupportTickets, updateSupportTicket } = require("../controllers/supportTicket.controller");
const { authMiddleware } = require("../middlewares/authMiddleware"); // your auth middleware

// POST /support-tickets - Create a new support ticket
router.post("/support-tickets", authMiddleware, createSupportTicket);

// GET /support-tickets - Get user's support tickets (with optional status query)
router.get("/support-tickets", authMiddleware, getSupportTickets);

router.patch("/admin/support-tickets/:id", authMiddleware, updateSupportTicket)
module.exports = router;
