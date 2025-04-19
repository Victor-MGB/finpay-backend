// routes/virtualCard.js
const express = require("express");
const router = express.Router();
const { issueVirtualCard, blockVirtualCard, unblockVirtualCard, getUserVirtualCards, getVirtualCardById } = require("../controllers/virtualCardController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.post("/virtual-cards", authMiddleware, issueVirtualCard);

router.patch("/:id/block", authMiddleware, blockVirtualCard);

router.patch("/:id/unblock", authMiddleware, unblockVirtualCard);

router.get("/virtual-cards", authMiddleware, getUserVirtualCards);

router.get("/virtual-cards/:id", authMiddleware, getVirtualCardById);

module.exports = router;
