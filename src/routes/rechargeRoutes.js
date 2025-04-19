const express = require("express");
const router = express.Router();
const { createRecharge, getRecharges, getRechargeById, cancelPendingRecharge } = require("../controllers/rechargeController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.post("/recharges", authMiddleware, createRecharge);

// route
router.get("/recharges", authMiddleware, getRecharges);

//get recharge by ID
router.get("/recharges/:id", authMiddleware, getRechargeById);

// route
router.delete("/recharges/:id", authMiddleware, cancelPendingRecharge);


module.exports = router;
