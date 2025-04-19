const express = require("express");
const router = express.Router();
const {
  addPaymentMethod,
  getPaymentMethods,
  setDefaultPaymentMethod,
    deletePaymentMethod,
} = require("../controllers/paymentController");
const { authMiddleware } = require("../middlewares/authMiddleware");


// Route to add a payment method
router.post("/add-payments", authMiddleware, addPaymentMethod);

// Route to get all payment methods for a user
router.get("/payment-methods", authMiddleware, getPaymentMethods);

// PATCH: Set default payment method (requires authentication)
router.patch(
  "/payment-methods/:id/default",
  authMiddleware,
  setDefaultPaymentMethod
);

// Route to delete a payment method (requires authentication)
router.delete("/payment-methods/:id", authMiddleware, deletePaymentMethod); 


//exports routes
module.exports = router;
