const jwt = require("jsonwebtoken");
const User = require("../models/Users"); // Adjust path as necessary

// Middleware to check user roles
const authorizeRoles = (roles = []) => {
  return async (req, res, next) => {
    try {
      // Get the token from the request headers
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "Access Denied. No token provided." });
      }

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // Fetch user details from the database
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // Check if user role is allowed
      if (!roles.includes(user.role)) {
        return res.status(403).json({ message: "Access Denied. You do not have permission." });
      }

      // Proceed to next middleware/controller
      next();
    } catch (error) {
      res.status(401).json({ message: "Invalid or expired token." });
    }
  };
};

module.exports = authorizeRoles;
