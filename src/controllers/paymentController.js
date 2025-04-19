const {PaymentMethod, Merchant} = require("../models/Users");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.addPaymentMethod = async (req, res) => {
    try {
      const { type, cardNumber, expiry, cvv, bankAccountNumber, bankRoutingNumber, accountHolderType } = req.body;
      const userId = req.user.id; // Assuming authentication middleware sets req.user
  
      let token, cardLast4, cardBrand, bankAccountLast4;
  
      if (type === "card") {
        // Tokenize card via Stripe
        const stripeToken = await stripe.tokens.create({
          card: { number: cardNumber, exp_month: expiry.split("/")[0], exp_year: expiry.split("/")[1], cvc: cvv },
        });
  
        token = stripeToken.id;
        cardLast4 = cardNumber.slice(-4);
        cardBrand = stripeToken.card.brand;
      } else if (type === "bank_account") {
        // Tokenize bank account via Stripe
        const stripeToken = await stripe.tokens.create({
          bank_account: {
            country: "NG",
            currency: "ngn",
            account_number: bankAccountNumber,
            routing_number: bankRoutingNumber,
            account_holder_type: accountHolderType, // "individual" or "company"
          },
        });
  
        token = stripeToken.id;
        bankAccountLast4 = bankAccountNumber.slice(-4);
      } else {
        return res.status(400).json({ message: "Invalid payment type" });
      }
  
      // Check if user has any existing payment method
      const existingMethods = await PaymentMethod.find({ userId });
      const isDefault = existingMethods.length === 0;
  
      // Save payment method
      const paymentMethod = new PaymentMethod({
        userId,
        type,
        cardLast4,
        cardBrand,
        bankAccountLast4,
        bankRoutingNumber,
        accountHolderType,
        token,
        isDefault,
      });
  
      await paymentMethod.save();
  
      res.status(201).json({ paymentMethodId: paymentMethod._id });
    } catch (error) {
      console.error("Error adding payment method:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  // Get all payment methods for a user
  exports.getPaymentMethods = async (req, res) => {
    try {
      const userId = req.user.id; // Authenticated user
  
      // Fetch payment methods (excluding full card/bank details)
      const paymentMethods = await PaymentMethod.find({ userId })
        .select("type cardLast4 cardBrand bankAccountLast4 bankRoutingNumber isDefault createdAt");
  
      res.status(200).json({ paymentMethods });
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  //update payment method to default
  exports.setDefaultPaymentMethod = async (req, res) => {
    try {
      const userId = req.user.id; // Authenticated user
      const { id } = req.params; // Payment method ID from URL
  
      // Find the payment method and ensure it belongs to the user
      const paymentMethod = await PaymentMethod.findOne({ _id: id, userId });
  
      if (!paymentMethod) {
        return res.status(404).json({ message: "Payment method not found" });
      }
  
      // Step 1: Set all payment methods for this user to isDefault: false
      await PaymentMethod.updateMany({ userId }, { $set: { isDefault: false } });
  
      // Step 2: Set the selected payment method to isDefault: true
      await PaymentMethod.findByIdAndUpdate(id, { isDefault: true });
  
      res.status(200).json({ message: "Default payment method updated successfully" });
  
    } catch (error) {
      console.error("Error setting default payment method:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };


  //delete payment method
  exports.deletePaymentMethod = async (req, res) => {
    try {
      const userId = req.user.id; // Authenticated user
      const { id } = req.params; // Payment method ID from URL
  
      // Find the payment method and ensure it belongs to the user
      const paymentMethod = await PaymentMethod.findOne({ _id: id, userId });
  
      if (!paymentMethod) {
        return res.status(404).json({ message: "Payment method not found" });
      }

      // Prevent deletion if method is default
    if (paymentMethod.isDefault) {
      return res.status(400).json({ message: "Cannot delete the default payment method" });
    }
  
      // Delete the payment method
      await PaymentMethod.findByIdAndDelete(id);
  
      res.status(200).json({ message: "Payment method deleted / removed successfully" });
    } catch (error) {
      console.error("Error deleting payment method:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };


  exports.stripeWebhook = async (req, res) => {
    const event = req.body; // Stripe event
  
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


  exports.chargePerRequest = async (req, res, next) => {
    const merchant = await Merchant.findOne({ userId: req.user.id });
  
    if (!merchant || merchant.subscriptionPlan !== "developer") return next();
  
    await stripe.invoiceItems.create({
      customer: merchant.stripeCustomerId,
      amount: 1, // $0.01 per request
      currency: "usd",
      description: "API Usage Charge",
    });
  
    next();
  };