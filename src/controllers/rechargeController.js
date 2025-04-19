const { Recharge, Wallet, Transaction, AuditLog, TransactionFee} = require("../models/Users");
const { v4: uuidv4 } = require("uuid");

exports.createRecharge = async (req, res) => {
  try {
    const { type, phoneNumber, provider, amount, currency } = req.body;
    const userId = req.user._id;

    // Validate recharge type
    if (!["mobile", "dth"].includes(type)) {
      return res.status(400).json({ message: "Invalid recharge type. Use 'mobile' or 'dth'." });
    }

    // Fetch wallet
    const wallet = await Wallet.findOne({ userId, currency });
    const feeAmount = 0.5;
    const totalCost = amount + feeAmount;

    if (!wallet || parseFloat(wallet.balance.toString()) < totalCost) {
      return res.status(403).json({ message: "Insufficient balance in wallet" });
    }

    // Step 1: Create Recharge with pending status
    const recharge = await Recharge.create({
      userId,
      type,
      phoneNumber,
      provider,
      amount,
      currency,
      status: "pending",
    });

    // Step 2: Create Transaction
    const transaction = await Transaction.create({
      senderId: userId,
      receiverId: null,
      amount,
      currency,
      status: "completed",
      type: "payment",
      reference: `recharge-${uuidv4()}`,
      description: `${type} recharge to ${phoneNumber}`,
      completedAt: new Date(),
    });

    // Step 3: Deduct amount + fee from wallet
    wallet.balance = parseFloat(wallet.balance.toString()) - totalCost;
    await wallet.save();

    // Step 4: Create TransactionFee
    await TransactionFee.create({
      transactionId: transaction._id,
      amount: feeAmount,
      currency,
      type: "processing",
    });

    // Step 5: Update recharge
    recharge.status = "completed";
    recharge.transactionId = transaction._id;
    await recharge.save();

    // Step 6: Notify user (email or socket placeholder)
    await sendEmail(req.user.email, "Recharge Successful", `<p>You recharged ${amount} ${currency} to ${phoneNumber}.</p>`);

    // Step 7: Log to admin
    // await AuditLog.create({
    //   action: "RECHARGE",
    //   userId,
    //   description: `Recharge of ${amount} ${currency} to ${phoneNumber} (${type})`,
    //   metadata: { transactionId: transaction._id, rechargeId: recharge._id },
    // });

    return res.status(201).json({ rechargeId: recharge._id });

  } catch (error) {
    console.error("Recharge error:", error);
    return res.status(500).json({ message: "Recharge failed" });
  }
};
// controller
exports.getRecharges = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, status } = req.query;

    // Build dynamic query filter
    const filter = { userId };
    if (type) filter.type = type.toLowerCase();
    if (status) filter.status = status.toLowerCase();

    const recharges = await Recharge.find(filter)
      .populate("transactionId")
      .sort({ createdAt: -1 });

    if (!recharges || recharges.length === 0) {
      return res.status(404).json({ message: "No recharges found." });
    }

    // Format response
    const formatted = recharges.map((r) => ({
      type: r.type,
      amount: r.amount,
      status: r.status,
      currency: r.currency,
      phoneNumber: r.phoneNumber,
      provider: r.provider,
      transactionId: r.transactionId?._id,
      transactionRef: r.transactionId?.reference,
      createdAt: r.createdAt,
    }));

    return res.status(200).json({ recharges: formatted });
  } catch (error) {
    console.error("Error fetching recharges:", error);
    return res.status(500).json({ message: "Server error fetching recharges." });
  }
};


exports.getRechargeById = async (req, res) => {
  try {
    const userId = req.user._id;
    const rechargeId = req.params.id;

    const recharge = await Recharge.findOne({ _id: rechargeId, userId })
      .populate("transactionId");

    if (!recharge) {
      return res.status(404).json({ message: "Recharge not found." });
    }

    res.status(200).json({
      recharge: {
        type: recharge.type,
        phoneNumber: recharge.phoneNumber,
        provider: recharge.provider,
        amount: recharge.amount,
        currency: recharge.currency,
        status: recharge.status,
        transactionId: recharge.transactionId?._id,
        transactionRef: recharge.transactionId?.reference,
        createdAt: recharge.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching recharge:", error);
    res.status(500).json({ message: "Server error fetching recharge." });
  }
};
 

  // controller
exports.cancelPendingRecharge = async (req, res) => {
    try {
      const recharge = await Recharge.findOne({
        _id: req.params.id,
        userId: req.user._id,
        status: "pending",
      });
  
      if (!recharge) {
        return res.status(404).json({ message: "Recharge not found or cannot be cancelled" });
      }
  
      // Refund user (optional if amount was already deducted)
      const wallet = await Wallet.findOne({ userId: req.user._id, currency: recharge.currency });
      if (wallet) {
        wallet.balance = parseFloat(wallet.balance.toString()) + recharge.amount;
        await wallet.save();
      }
  
      await Recharge.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: "Recharge cancelled and refunded successfully" });
    } catch (err) {
      res.status(500).json({ message: "Error cancelling recharge" });
    }
  };
  
  