const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationController");
const { authMiddleware } = require("../middlewares/authMiddleware"); // assumes you have authentication middleware

router.get("/notifications", authMiddleware, getNotifications);

router.patch("/notifications/:id/read", authMiddleware, markNotificationAsRead);

router.patch(
  "/notifications/read-all",
  authMiddleware,
  markAllNotificationsAsRead
);

module.exports = router;
