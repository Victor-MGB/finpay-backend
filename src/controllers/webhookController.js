const {Merchant} = require("../models/Merchant");

exports.stripeWebhook = async (req, res) => {
  const event = req.body; 

  if (event.type === "invoice.payment_failed") {
    const customerId = event.data.object.customer;
    const merchant = await Merchant.findOne({ stripeCustomerId: customerId });

    if (merchant) {
      merchant.subscriptionPlan = "developer";
      merchant.expiryDate = null;
      await merchant.save();
    }
  }

  res.status(200).send("Webhook received.");
};
