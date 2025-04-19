const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const {
  Payout,
  Wallet,
  PaymentMethod,
  Transaction,
  TransactionFee,
  CurrencyConversion,
  AuditLog,
} = require("../models/Users");

exports.requestPayout = async (req, res) => {
  try {
    const { paymentMethodId, amount, currency, transferType } = req.body;
    const userId = req.user.id; // Authenticated user

    // Validate Wallet Balance
    const wallet = await Wallet.findOne({ userId, currency });
    if (!wallet || parseFloat(wallet.balance) < amount) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // Determine Fees
    const processingFee = 1.0; // Fixed fee
    let currencyConversionFee = 0;

    // Validate Payment Method
    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    if (paymentMethod.type !== "bank_account") {
      return res.status(400).json({ message: "Payment method must be a bank account." });
    }

    // Currency Conversion Logic
    if (currency !== paymentMethod.currency) {
      const conversionRate = await CurrencyConversion.findOne({
        baseCurrency: currency,
        targetCurrency: paymentMethod.currency,
      });

      if (!conversionRate) {
        return res.status(400).json({ message: "Currency conversion rate unavailable" });
      }

      currencyConversionFee = amount * 0.02; // 2% conversion fee
    }

    const totalFee = processingFee + currencyConversionFee;
    const totalDeduction = amount + totalFee;

    // Deduct Wallet Balance
    wallet.balance = parseFloat(wallet.balance) - totalDeduction;
    await wallet.save();

    // Create Transaction
    const transaction = await Transaction.create({
      senderId: userId,
      amount,
      currency,
      status: "pending",
      type: "transfer",
      paymentMethodId,
      reference: `TX-${Date.now()}`,
      description: `Payout (${transferType})`,
    });

    // Create Transaction Fee(s)
    const feeTypes = [];

    if (processingFee) {
      feeTypes.push({
        transactionId: transaction._id,
        amount: processingFee,
        currency,
        type: "processing",
      });
    }

    if (currencyConversionFee > 0) {
      feeTypes.push({
        transactionId: transaction._id,
        amount: currencyConversionFee,
        currency,
        type: "currency_conversion",
      });
    }

    await TransactionFee.insertMany(feeTypes);

    // Create Payout (linked to transaction)
    const payout = await Payout.create({
      userId,
      paymentMethodId,
      amount,
      currency,
      transferType,
      status: "pending",
      transactionId: transaction._id, // ✅ Link payout to transaction
    });

    // Process Payout via Stripe
    const stripePayout = await stripe.payouts.create({
      amount: amount * 100, // Convert to cents
      currency,
      method: "instant", // Could be conditional per transferType
      metadata: {
        userId: userId.toString(),
        payoutId: payout._id.toString(),
        transferType,
      },
    });

    if (stripePayout.status === "paid") {
      payout.status = "completed";
      payout.completedAt = new Date();
      transaction.status = "completed";

      await Promise.all([payout.save(), transaction.save()]);

      // Audit Log
      await AuditLog.create({
        performed_by: userId,
        action: "Payout completed",
        entity_type: "Transaction",
        entity_id: transaction._id,
        details: `Payout of ${amount} ${currency} via ${transferType}`,
      });

      return res.status(200).json({
        message: "Payout successful",
        payoutId: payout._id,
      });
    } else {
      payout.status = "failed";
      transaction.status = "failed";

      await Promise.all([payout.save(), transaction.save()]);
      return res.status(400).json({ message: "Payout failed" });
    }
  } catch (error) {
    console.error("Payout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUserPayouts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const payouts = await Payout.find(query)
      .populate("paymentMethodId")
      .select("amount currency status transferType createdAt completedAt paymentMethodId");

    return res.status(200).json({
      message: "Payouts retrieved",
      payouts,
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPayoutById = async (req, res) => {
  try {
    const { id } = req.params; // Get payout ID from request params
    const userId = req.user.id; // Get authenticated user ID

    // Fetch payout by ID and populate paymentMethodId
    const payout = await Payout.findById(id).populate("paymentMethodId");

    // Check if payout exists
    if (!payout) {
      return res.status(404).json({ message: "Payout not found" });
    }

    // Ensure the payout belongs to the authenticated user
    if (payout.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    return res.status(200).json({ message: "Payout retrieved", payout });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
