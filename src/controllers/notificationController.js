const {Notification} = require("../models/Users"); // adjust path if needed

// GET /notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const filter = { userId };

    // If isRead is provided in query (either "true" or "false")
    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === "true"; // cast to boolean
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// PATCH /notifications/:id/read
exports.markNotificationAsRead = async (req, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user.id;
  
      const notification = await Notification.findOne({
        _id: notificationId,
        userId: userId,
      });
  
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found or not authorized",
        });
      }
  
      notification.isRead = true;
      await notification.save();
  
      res.status(200).json({
        success: true,
        message: "Marked as read",
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  };

  // PATCH /notifications/read-all
exports.markAllNotificationsAsRead = async (req, res) => {
    try {
      const userId = req.user.id;
  
      await Notification.updateMany(
        { userId, isRead: false },
        { $set: { isRead: true } }
      );
  
      res.status(200).json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  };
  