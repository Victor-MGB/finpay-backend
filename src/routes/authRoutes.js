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
/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phone
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request, validation error
 *       409:
 *         description: Email or phone number already registered
 *       500:
 *         description: Internal server error
 */
router.post("/register", registerUser);

//Verify OTP endpoint
/**
 * @swagger
 * /verify-phone-otp:
 *   post:
 *     summary: Verify user's phone number using OTP
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - otp
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 64a1f7b3d8b7d8a9f1f5f2a7
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP verified successfully!
 *                 isVerified:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid input, expired OTP, or max attempts reached
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid OTP. Please try again
 *       500:
 *         description: Internal server error
 */
router.post("/verify-phone-otp", verifyOTPFromPhoneNumber);

//Resend OTP endpoint
/**
 * @swagger
 * /resend-otp:
 *   post:
 *     summary: Resend a new OTP to the user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 64a1f7b3d8b7d8a9f1f5f2a7
 *     responses:
 *       200:
 *         description: New OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: New OTP sent successfully!
 *                 otp:
 *                   type: string
 *                   example: "123456"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/resend-otp", resendOTP);

//Login endpoint
router.post("/login", loginUser);

router.patch('/users/biometric', authMiddleware, enableBiometric);

router.patch('/users/deactivate', authMiddleware, deactivateAccount);

module.exports = router;
