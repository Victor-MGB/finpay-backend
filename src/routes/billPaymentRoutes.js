const express = require("express");
const router = express.Router();
const { payBill, getBillPayments, getBillPaymentById, cancelPendingBillPayment } = require("../controllers/BillPaymentController");
const { authMiddleware } = require("../middlewares/authMiddleware"); // your JWT middleware

// @route   POST /bill-payments
// @desc    Pay utility or credit card bill
// @access  Private (Requires authentication)
router.post("/bill-payments", authMiddleware, payBill);

// @route   GET /bill-payments
router.get("/bill-payments", authMiddleware, getBillPayments);

router.get("/bill-payments/:id", authMiddleware, getBillPaymentById);

router.delete("/bill-payments/:id", authMiddleware, cancelPendingBillPayment);

module.exports = router;
