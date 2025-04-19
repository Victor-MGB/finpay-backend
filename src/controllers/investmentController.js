const mongoose = require('mongoose');
const { Investment, Currency, Wallet, Transaction, TransactionFee, AuditLog, Notification } = require('../models/Users'); // adjust path if needed

exports.purchaseInvestment = async (req, res) => {
    const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { type, amount, currency, walletId } = req.body;
    const userId = req.user.id;

    const validTypes = ["mutual_fund", "stock", "bond", "fixed_deposit", "recurring_deposit"];

    // 1. Validate investment type
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid investment type" });
    }

    // 2. Fetch Wallet
    const wallet = await Wallet.findOne({ wallet_id: walletId, userId }).session(session);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Convert Decimal128 to Number
    const walletBalance = parseFloat(wallet.balance.toString());

    // 3. Check if wallet has enough balance
    const processingFee = amount * 0.005; // 0.5%
    const totalAmount = amount + processingFee;

    if (walletBalance < totalAmount) {
      return res.status(403).json({ message: "Insufficient balance" });
    }

    // 4. Deduct total amount (investment + fee)
    wallet.balance = (walletBalance - totalAmount).toFixed(2);
    await wallet.save({ session });

    // 5. Create Investment
    const investment = await Investment.create([{
      userId,
      type,
      amount,
      currency,
      status: "active",
    }], { session });

    // 6. Create main Transaction (investment purchase)
    const mainTransaction = await Transaction.create([{
      senderId: userId,
      receiverId: null,
      amount,
      currency,
      status: "completed",
      type: "payment",
      reference: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description: `Investment purchase - ${type}`,
      completedAt: new Date(),
    }], { session });

    // 7. Create Transaction Fee
    await TransactionFee.create([{
      transactionId: mainTransaction[0]._id,
      amount: processingFee,
      currency,
      type: "processing",
    }], { session });

    // 8. Create Audit Log
    await AuditLog.create([{
      performed_by: userId,
      action: `Purchased ${type} investment`,
      entity_type: "User",
      entity_id: userId,
      details: `Investment of ${amount} ${currency} with 0.5% processing fee`,
    }], { session });

    // 9. Create Notification
    await Notification.create([{
      userId,
      message: `Your investment of ${amount} ${currency} in ${type} was successful!`,
    }], { session });

    // 10. Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ investmentId: investment[0]._id });
  } catch (error) {
    console.error(error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


// List investments
exports.listInvestments = async (req, res) => {
    try {
      const { type, status } = req.query;
      const filters = { userId: req.user.id };
  
      if (type) filters.type = type;
      if (status) filters.status = status;
  
      const investments = await Investment.find(filters).select('_id type amount status performanceHistory');
  
      if (!investments.length) {
        return res.status(404).json({ message: 'No investments found.' });
      }
  
      res.status(200).json({ investments });
    } catch (error) {
      console.error('Error listing investments:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };


  exports.sellInvestment = async (req, res) => {
    try {
      const { investmentId, walletId } = req.body;
  
      if (!investmentId || !walletId) {
        return res.status(400).json({ message: "investmentId and walletId are required." });
      }
  
      // Find Investment
      const investment = await Investment.findOne({ _id: investmentId, userId: req.user.id });
      if (!investment) {
        return res.status(400).json({ message: "Invalid investmentId." });
      }
      if (investment.status !== "active") {
        return res.status(403).json({ message: "Investment already sold or matured." });
      }
  
      // Calculate Current Value (latest value from performanceHistory or original amount)
      let currentValue = investment.amount;
      if (investment.performanceHistory.length > 0) {
        const latestPerformance = investment.performanceHistory[investment.performanceHistory.length - 1];
        currentValue = latestPerformance.value;
      }
  
      // Apply 0.5% processing fee
      const feeAmount = +(currentValue * 0.005).toFixed(2); // 0.5%
      const amountAfterFee = +(currentValue - feeAmount).toFixed(2);
  
      // Update Wallet Balance
      const wallet = await Wallet.findOne({ _id: walletId, userId: req.user.id });
      if (!wallet) {
        return res.status(400).json({ message: "Invalid walletId." });
      }
  
      wallet.balance = +(parseFloat(wallet.balance) + amountAfterFee).toFixed(2);
      await wallet.save();
  
      // Update Investment status
      investment.status = "sold";
      await investment.save();
  
      // Create Transaction
      const newTransaction = await Transaction.create({
        senderId: null, // investment sale, external source
        receiverId: req.user.id,
        amount: amountAfterFee,
        currency: investment.currency,
        status: "completed",
        type: "payment",
        reference: `INVEST-SELL-${Date.now()}`,
        description: "Investment Sale Credit",
      });
  
      // Create Transaction Fee
      await TransactionFee.create({
        transactionId: newTransaction._id,
        amount: feeAmount,
        currency: investment.currency,
        type: "processing",
      });
  
      // Create Audit Log
      await AuditLog.create({
        performed_by: req.user.id,
        action: "Sold investment",
        entity_type: "Transaction",
        entity_id: newTransaction._id,
        details: `Sold investment ${investmentId} for amount ${amountAfterFee} ${investment.currency}`,
      });
  
      res.status(201).json({ transactionId: newTransaction._id });
  
    } catch (error) {
      console.error("Error selling investment:", error);
      res.status(500).json({ message: "Server error" });
    }
  };