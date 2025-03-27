const {User, AuditLog} = require("../models/Users"); // Import User model
const sendEmail = require("../utils/sendEmail"); // Import sendEmail utility
const mongoose = require("mongoose");

// Get all users
const getAllUsers = async (req, res) => {
    try {
        console.log("User model:", User); // Debugging step
      const users = await User.find().select("-password"); // Exclude passwords for security
      res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("❌ Error fetching users:", error); // Debugging log
      res.status(500).json({ success: false, message: "Server error", error });
    }
  };


// Get single user
const getUserById = async (req, res) => {
    try {
        console.log("User ID:", req.params.id); // Debugging

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid User ID", success: false });
        }

        const user = await User.findById(req.params.id).select("-password");
        
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("🔥 Error fetching user:", error);
        res.status(500).json({ message: error.message, success: false });
    }
};

    //update user
    const updateUser = async (req, res) => {
        try {
            const { fullname, email, phone, dateOfBirth } = req.body;
            const userId = req.params.id;
    
            // Calculate age from dateOfBirth
            let age = null;
            if (dateOfBirth) {
                const birthDate = new Date(dateOfBirth);
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }
    
            const updateUser = await User.findByIdAndUpdate(
                userId,
                { fullname, email, phone, dateOfBirth, age, updatedAt: new Date() },
                { new: true, runValidators: true }
            ).select("-password");
    
            if (!updateUser) {
                return res.status(404).json({ message: "User not found", success: false });
            }
    
            res.status(200).json({ success: true, message: "Profile updated", user: updateUser });
        } catch (error) {
            res.status(500).json({ message: error.message, success: false });
        }
    };
    

    //Delete user
const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        res.status(200).json({ success: true, message: "User deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message, success: false });
    }
    }

    const updateUserStatus = async (req, res) => {
        try {
          const { userId, status, suspensionDays } = req.body;
          const adminId = req.user.id;
          const adminRole = req.user.role;
      
          if (!["active", "inactive", "suspended"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
          }
      
          const user = await User.findById(userId);
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }
      
          // 🚨 Restrict admin actions
          if (adminRole === "admin" && ["admin", "superadmin"].includes(user.role)) {
            return res.status(403).json({ message: "Admins cannot modify another admin or superadmin" });
          }
      
          if (status === "suspended") {
            user.disabled = true;
            user.suspensionEndDate = suspensionDays
              ? new Date(Date.now() + suspensionDays * 24 * 60 * 60 * 1000)
              : null;
            user.reactivationWaitUntil = null;
      
            // 📩 Send Suspension Email
            await sendEmail(
              user.email,
              "Account Suspended",
              `Your account has been suspended for ${suspensionDays} days.\n\nIf you have any questions, please contact support.`
            );
      
          } else if (status === "active" && user.status === "suspended") {
            user.disabled = true;
            user.reactivationWaitUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
            user.suspensionEndDate = null;
      
            // 📩 Send Reactivation Email
            await sendEmail(
              user.email,
              "Account Reactivated",
              `Your account has been reactivated, but you must wait 24 hours before logging in.`
            );
      
          } else {
            user.disabled = false;
            user.reactivationWaitUntil = null;
            user.suspensionEndDate = null;
          }
      
          user.status = status;
          await user.save();
      
          await AuditLog.create({
            performed_by: adminId,
            action: `User status updated to ${status}`,
            entity_type: "User",
            entity_id: userId,
            details: status === "suspended" ? `Suspended for ${suspensionDays} days` : "Status changed",
          });
      
          res.json({ message: "Status updated successfully" });
      
        } catch (error) {
          res.status(500).json({ message: "Internal Server Error", error: error.message });
        }
      };      
      
      
    // Export functionS
    module.exports = {
        getAllUsers,
        getUserById,
        updateUser,
        deleteUser,
        updateUserStatus
    }