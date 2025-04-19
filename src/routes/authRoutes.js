const express = require("express");
const {
  registerUser,
  verifyOTPFromPhoneNumber,
  resendOTP,
  loginUser,
  enableBiometric,
  deactivateAccount
} = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware"); // assumes you have authentication middleware
const router = express.Router();

// Register endpoint
router.post("/register", registerUser);

//Verify OTP endpoint
router.post("/verify-phone-otp", verifyOTPFromPhoneNumber);

//Resend OTP endpoint
router.post("/resend-otp", resendOTP);

//Login endpoint
router.post("/login", loginUser);

router.patch('/users/biometric', authMiddleware, enableBiometric);

router.patch('/users/deactivate', authMiddleware, deactivateAccount);

module.exports = router;
