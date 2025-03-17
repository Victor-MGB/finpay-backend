const {User} = require("../models/Users"); // Import User model
const securityLog = require("../models/SecurityLogSchema"); // Import Security Log model
// Get all users
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
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ message: error.message, success: false });
    }
    }

    //update user
    const updateUser = async (req, res) => {
        try {
            const { fullname, email, phone } = req.body;
            const userId = req.params.id;
            const updateUser = await User.findByIdAndUpdate(
                userId,
                { fullname, email, phone },
                { new: true, runValidators: true }
            ).select("-password");
            if (!updateUser) {
                return res.status(404).json({ message: "User not found", success: false });
            }

            res.status(200).json({ success: true, message: "Profile updated", user: updateUser });
        }catch (error) {
            res.status(500).json({ message: error.message, success: false });
        }
    }

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

    // user security logs
    const getSecurityLogsByUser = async (req, res) => {
        try {
            const {userId} = req.params; // Get user ID from URL
            const logs = await securityLog.find({ userId }).sort({ createdAt: -1 });
            if (logs.length === 0) {
                return res.status(404).json({ message: "No security logs found", success: false });
            }
            res.status(200).json({ success: true, logs });
        } catch (error) {
            console.error("Error fetching security logs:", error)
            res.status(500).json({ message: error.message, success: false });
        }
    }

    // Export functions
    module.exports = {
        getAllUsers,
        getUserById,
        updateUser,
        deleteUser,
        getSecurityLogsByUser,
    }