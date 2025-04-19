const { Merchant } = require("../models/Users");

const checkPlanExpiry = async (req, res, next) => {
  if (!req.user || !req.user.merchant) return next();

  const merchant = await Merchant.findOne({ userId: req.user.id });

  if (!merchant) return next();

  // If the plan is "developer", skip expiry check
  if (merchant.subscriptionPlan === "developer") return next();

  // If the plan has expired, downgrade to "developer"
  if (merchant.expiryDate && new Date() > new Date(merchant.expiryDate)) {
    merchant.subscriptionPlan = "developer";
    merchant.expiryDate = null;
    await merchant.save();
  }

  next();
};

module.exports = checkPlanExpiry;
