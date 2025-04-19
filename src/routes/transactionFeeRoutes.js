const express = require("express");
const router = express.Router();
const {
    getTransactionFees
} = require("../controllers/transactionFeeController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Route to get all transactionFee for a user (requires authentication)
router.get("/transaction-fees/:transactionId", authMiddleware, getTransactionFees);

module.exports = router;
