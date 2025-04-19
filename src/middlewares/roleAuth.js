const {Merchant} = require("../models/Users");

const roleAuth = (allowedRoles) => {
  return async (req, res, next) => {
    const merchant = await Merchant.findOne({ userId: req.user.id });

    if (!merchant) {
      return res.status(403).json({ message: "Merchant account required." });
    }

    const userRole = merchant.teamMembers.find(member => member.userId.equals(req.user.id))?.role || "developer";

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Access denied." });
    }

    next();
  };
};

module.exports = roleAuth;
