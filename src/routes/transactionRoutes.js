const express = require("express");
const router = express.Router();
const {
  sendPayment,
  transferFunds,
  refundTransaction,
  listTransactions,
  getTransactionById
} = require("../controllers/transactionsController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Route to send payment (requires authentication)
router.post(" /transactions/payment", authMiddleware, sendPayment);

//Routes to transfer funds
router.post("/transactions/transfer", authMiddleware, transferFunds);

//routes to refund from stripe or in-app refunds
router.post("/transactions/refund", authMiddleware, refundTransaction);

// Route to get all transactions for a user (requires authentication)
router.get("/transactions", authMiddleware, listTransactions);

//get transaction by ID
router.get("/transactions/:id", authMiddleware, getTransactionById)

module.exports = router;
