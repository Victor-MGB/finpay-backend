const express = require("express");
const {
  registerUser,
  verifyOTPFromPhoneNumber,
  resendOTP,
  loginUser,
} = require("../controllers/authController");
const router = express.Router();

// Register endpoint
router.post("/register", registerUser);

//Verify OTP endpoint
router.post("/verify-phone-otp", verifyOTPFromPhoneNumber);

//Resend OTP endpoint
router.post("/resend-otp", resendOTP);

//Login endpoint
router.post("/login", loginUser);
module.exports = router;
