const rateLimit = require("express-rate-limit");
const {Merchant} = require("../models/Users");

const rateLimitMiddleware = async (req, res, next) => {
  const merchant = await Merchant.findOne({ userId: req.user.id });

  if (!merchant) return res.status(403).json({ message: "Merchant account required." });

  const planLimits = {
    developer: 1000,
    basic: 10000,
    pro: 50000,
    enterprise: "unlimited",
  };

  const maxRequests = planLimits[merchant.subscriptionPlan];

  if (maxRequests === "unlimited") {
    return next();
  }

  const limiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: maxRequests,
    message: "API request limit reached for your plan.",
  });

  return limiter(req, res, next);
};

module.exports = rateLimitMiddleware;
