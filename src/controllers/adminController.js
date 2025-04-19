const twilio = require("twilio");
const dotenv = require("dotenv");
const {User, Notification, AuditLog} = require("../models/Users");
dotenv.config();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

exports.sendUpdatesToUsers = async (req, res) => {
    try {
        const {message} = req.body;
        if(!message) {
            return res.status(400).json({success: false, message: "Please provide a message"});
        }

        //fetch all users phone numbers
        const users = await User.find({}, "phoneNumber");

        if(!users.length){
            return res.status(404).json({success: false, message: "No users found"});
        }

        //send message to all users
        for(let user of users){
            if(user.phoneNumber){
                await client.message.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: user.phoneNumber
                })
            }
        }

        return res.status(200).json({success: true, message: "Message sent successfully"});
    } catch (error) {
        console.error("Error sending updates", error);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
}

exports.listUsers = async (req, res) => {
  try {
    const admin = req.user;

    // Only allow admin, superadmin, and compliance (optional - add compliance if needed)
    const allowedRoles = ["admin", "superadmin", "compliance"];
    if (!allowedRoles.includes(admin.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    const {
      status,
      role,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (role) filter.role = role;

    // Date filter (createdAt range)
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;
    const skip = (parsedPage - 1) * parsedLimit;

    // Fetch users and total count in parallel
    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select("_id fullName email role status kycVerified createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(), // Add .lean() for better performance if no virtuals are needed
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalUsers / parsedLimit);

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      meta: {
        totalUsers,
        totalPages,
        currentPage: parsedPage,
        pageSize: parsedLimit,
      },
      data: users,
    });
  } catch (err) {
    console.error("Error listing users:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
      error: err.message,
    });
  }
};
  
  exports.updateKycStatus = async (req, res) => {
    try {
      const admin = req.user;
  
      if (!["admin", "compliance", "superadmin"].includes(admin.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
  
      const { id } = req.params;
      const { documentId, status, reason } = req.body;
  
      if (!["verified", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
  
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Find the specific document
      const document = user.kycDocuments.id(documentId);
      if (!document) {
        return res.status(404).json({ message: "KYC document not found" });
      }
  
      // Update document status
      document.status = status;
      document.reviewedAt = new Date();
      document.reviewedBy = admin._id;
      if (reason && status === "rejected") {
        document.reason = reason;
      }
  
      // Check if all documents are verified
      const allVerified = user.kycDocuments.every(
        (doc) => doc.status === "verified"
      );
      user.kycVerified = allVerified;
  
      await user.save();
  
      // Send Notification to user
      const message =
        status === "verified"
          ? `Your ${document.documentType} has been verified.`
          : `Your ${document.documentType} was rejected. Reason: ${reason || "Not specified"}`;
  
      await Notification.create({
        userId: user._id,
        message,
      });
  
      // Log in AuditLog
      await AuditLog.create({
        performed_by: admin._id,
        action: `KYC document ${status}: ${document.documentType}`,
        entity_type: "User",
        entity_id: user._id,
        details: `Document ID: ${documentId}, Status: ${status}${reason ? `, Reason: ${reason}` : ""}`,
      });
  
      return res.status(200).json({ message: "KYC status updated" });
    } catch (err) {
      console.error("Error updating KYC:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  };


  exports.updateUserRole = async (req, res) => {
    try {
      const admin = req.user;
  
      if (admin.role !== "superadmin") {
        return res.status(403).json({ message: "Only superadmin can change roles" });
      }
  
      const { id } = req.params;
      const { role } = req.body;
  
      const validRoles = ["user", "admin", "support", "compliance"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role value" });
      }
  
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const previousRole = user.role;
      user.role = role;
      await user.save();
  
      // Log role change in AuditLog
      await AuditLog.create({
        performed_by: admin._id,
        action: `Changed role from ${previousRole} to ${role}`,
        entity_type: "User",
        entity_id: user._id,
        details: `Updated role for ${user.fullName} (${user.email})`,
      });
  
      return res.status(200).json({ message: "Role updated" });
    } catch (err) {
      console.error("Error updating user role:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  };


  exports.updateUserStatus = async (req, res) => {
    try {
      const admin = req.user;
      const { id } = req.params;
      const { status } = req.body;
  
      const allowedRoles = ["admin", "superadmin"];
      if (!allowedRoles.includes(admin.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Admins only.",
        });
      }
  
      const validStatuses = ["active", "inactive", "suspended"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value.",
        });
      }
  
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
  
      if (user.role === "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Cannot modify a superadmin account.",
        });
      }
  
      if (user.role === "admin" && admin.role !== "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Only superadmin can modify an admin.",
        });
      }
  
      user.status = status;
      await user.save();
  
      // Log to AuditLog
      await AuditLog.create({
        performed_by: admin._id,
        action: `Updated user status to ${status}`,
        entity_type: "User",
        entity_id: user._id,
        details: `Admin (${admin.fullName}) changed status of user (${user.fullName}) to ${status}`,
      });
  
      // Send SMS Notification via Twilio
      if (user.phoneNumber) {
        const message = `Hello ${user.fullName}, your account status has been updated to: ${status}.`;
        
        await client.messages.create({
          body: message,
          to: user.phoneNumber, // Must be a complete number like +234xxxxxxxxxx
          from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
        });
      }
  
      return res.status(200).json({
        success: true,
        message: "User status updated successfully.",
      });
    } catch (err) {
      console.error("Error updating user status:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to update user status.",
        error: err.message,
      });
    }
  };