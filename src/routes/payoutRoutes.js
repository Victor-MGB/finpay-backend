const express = require("express");
const router = express.Router();
const { requestPayout, getUserPayouts, getPayoutById } = require("../controllers/payoutController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.post("/payouts", authMiddleware, requestPayout);

//get payout by ID
router.get("/payouts", authMiddleware, getUserPayouts);

//Get specific payout details
router.get("/payouts/:id", authMiddleware, getPayoutById);


module.exports = router;
