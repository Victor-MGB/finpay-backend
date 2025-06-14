const express = require("express");
const {
  registerUser,
  verifyOTPFromPhoneNumber,
  resendOTP,
  loginUser,
  enableBiometric,
  updateAlerts,
  deactivateAccount
} = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware"); // assumes you have authentication middleware
const router = express.Router();

// Register endpoint
/**
 * @swagger
 * /api/auth/register:
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
 * api/auth/verify-phone-otp:
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
 * api/auth/resend-otp:
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
/**
 * @swagger
 * api/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+2348012345678"
 *               password:
 *                 type: string
 *                 example: myStrongPassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login Successful
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     accountNumber:
 *                       type: string
 *                     accountPin:
 *                       type: string
 *                     finPayWallet:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Invalid credentials or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid credentials
 *       403:
 *         description: Account reactivation delay
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account reactivated. Please wait 24 hours before logging in.
 *       429:
 *         description: Too many failed login attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Too many failed login attempts. Try again later.
 *       500:
 *         description: Server error
 */
router.post("/login", loginUser);

/**
 * @swagger
 * api/auth/users/biometric:
 *   patch:
 *     summary: Enable or disable biometric login
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enable
 *             properties:
 *               enable:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Biometric login status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Biometric login enabled
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid input for 'enable'
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

router.patch('/users/biometric', authMiddleware, enableBiometric);

/**
 * @swagger
 * api/auth/users/deactivate:
 *   patch:
 *     summary: Deactivate the currently logged-in user's account
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account deactivated
 *       400:
 *         description: Account already deactivated or suspended
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account already deactivated
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.patch('/users/deactivate', authMiddleware, deactivateAccount);

/**
 * @swagger
 * api/auth/update-alerts:
 *   patch:
 *     summary: Update user alert preferences
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alerts
 *             properties:
 *               alerts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - type
 *                     - threshold
 *                     - active
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [low_balance, transaction, bill_due]
 *                       example: low_balance
 *                     threshold:
 *                       type: number
 *                       example: 100
 *                     active:
 *                       type: boolean
 *                       example: true
 *     responses:
 *       200:
 *         description: Alerts updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Alerts updated
 *       400:
 *         description: Bad request (e.g. invalid structure or missing fields)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Alerts array is required
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.post('/update-alerts', authMiddleware, updateAlerts);

module.exports = router;
