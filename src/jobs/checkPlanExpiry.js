const Merchant = require("../models/Users");
const sendEmail = require("../utils/sendEmail");

const checkPlanExpiry = async () => {
  const merchants = await Merchant.find({
    subscriptionPlan: { $ne: "developer" },
    expiryDate: { $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }, // 3 days from now
  });

  for (const merchant of merchants) {
    await sendEmail({
      to: merchant.userId.email,
      subject: "Subscription Expiry Warning",
      text: `Your plan will expire on ${merchant.expiryDate}. Please renew to avoid service interruptions.`,
    });
  }
};

module.exports = checkPlanExpiry;
