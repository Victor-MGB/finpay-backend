const express = require("express");
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserStatus,
} = require("../controllers/userController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const authorization = require("../middlewares/roleMiddleware");

// Create a new router
const router = express.Router();

// Get all users
/**
 * @swagger
 * /api/users/users:
 *   get:
 *     summary: Get all registered users
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: A list of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 64fa19b6e86eafcae4a1f00f
 *                       fullName:
 *                         type: string
 *                         example: Victor Mgbemena
 *                       email:
 *                         type: string
 *                         example: victor@example.com
 *                       phone:
 *                         type: string
 *                         example: +2348123456789
 *                       countryCode:
 *                         type: string
 *                         example: NG
 *                       ipCountryCode:
 *                         type: string
 *                         example: NG
 *                       location:
 *                         type: string
 *                         example: Lagos, Nigeria
 *                       isVerified:
 *                         type: boolean
 *                         example: false
 *                       status:
 *                         type: string
 *                         example: active
 *                       disabled:
 *                         type: boolean
 *                         example: false
 *       500:
 *         description: Server error
 */
router.get("/users", getAllUsers);

// Get single user
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: MongoDB ObjectId of the user
 *         schema:
 *           type: string
 *           example: 64fa19b6e86eafcae4a1f00f
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     countryCode:
 *                       type: string
 *                     ipCountryCode:
 *                       type: string
 *                     location:
 *                       type: string
 *                     isVerified:
 *                       type: boolean
 *                     status:
 *                       type: string
 *                     disabled:
 *                       type: boolean
 *       400:
 *         description: Invalid User ID format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid User ID
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Server error
 */
router.get("/users/:id", authMiddleware, getUserById);

// Update user
/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user profile information
 *     tags:
 *       - Users
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: MongoDB ObjectId of the user to update
 *         schema:
 *           type: string
 *           example: 64fa19b6e86eafcae4a1f00f
 *     requestBody:
 *       description: Fields to update for the user
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullname:
 *                 type: string
 *                 example: Victor Mgbemena
 *               email:
 *                 type: string
 *                 example: victor@example.com
 *               phone:
 *                 type: string
 *                 example: +2348123456789
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: 1990-06-15
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profile updated
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                     age:
 *                       type: integer
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Server error
 */
router.put("/users/:id", authMiddleware, updateUser);

// Delete user
/**
 * @swagger
 * /api/users/users/{id}:
 *   delete:
 *     summary: Delete a user by ID
 *     tags:
 *       - Users
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The user's MongoDB ObjectId
 *         schema:
 *           type: string
 *           example: 64fa19b6e86eafcae4a1f00f
 *     responses:
 *       200:
 *         description: User successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User deleted
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User not found
 *       500:
 *         description: Server error
 */
router.delete("/users/:id", deleteUser);

// Update user status
/**
 * @swagger
 * /api/users/status:
 *   put:
 *     summary: Update user status (active, inactive, suspended)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: User ID and status update info
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - status
 *             properties:
 *               userId:
 *                 type: string
 *                 description: MongoDB ObjectId of the user
 *                 example: 64fa19b6e86eafcae4a1f00f
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *                 example: suspended
 *               suspensionDays:
 *                 type: integer
 *                 description: Number of days to suspend the user (optional, used if status is suspended)
 *                 example: 7
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Status updated successfully
 *       400:
 *         description: Invalid status or bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid status
 *       403:
 *         description: Forbidden - Admins cannot modify other admins or superadmins
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Admins cannot modify another admin or superadmin
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
 *                   example: Internal Server Error
 *                 error:
 *                   type: string
 *                   example: Error message details
 */
router.patch("/users/status", authorization, updateUserStatus);

// Export the router
module.exports = router;
