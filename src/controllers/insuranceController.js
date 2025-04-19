const mongoose = require("mongoose");
const { InsurancePolicy,
    Wallet,
    Transaction,
    TransactionFee,
    AuditLog,
    Notification,
 }= require("../models/Users");

exports.purchaseInsurancePolicy = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { type, premium, currency, startDate, endDate, walletId } = req.body;
    const userId = req.user.id;

    // Step 1: Validate type
    if (!["life", "health", "vehicle"].includes(type)) {
      return res.status(400).json({ message: "Invalid insurance type." });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: "Start date must be before end date." });
    }

    // Step 2: Find wallet
    const wallet = await Wallet.findById(walletId).session(session);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found." });
    }

    if (wallet.userId.toString() !== userId) {
      return res.status(403).json({ message: "You can only use your own wallet." });
    }

    // Step 3: Check balance
    const balance = parseFloat(wallet.balance.toString());
    if (balance < premium) {
      return res.status(403).json({ message: "Insufficient wallet balance." });
    }

    // Step 4: Deduct premium
    wallet.balance = (balance - premium).toFixed(2);
    await wallet.save({ session });

    // Step 5: Create InsurancePolicy
    const newPolicy = await InsurancePolicy.create(
      [{
        userId,
        type,
        premium,
        currency,
        startDate,
        endDate,
        status: "active",
      }],
      { session }
    );

    // Step 6: Create Transaction
    const newTransaction = await Transaction.create(
      [{
        senderId: userId,
        receiverId: null,
        amount: premium,
        currency,
        type: "payment",
        status: "completed",
        reference: `INS-${Date.now()}`,
        description: `Premium payment for ${type} insurance`,
      }],
      { session }
    );

    // Step 7: Apply 1% processing fee
    const feeAmount = (premium * 0.01).toFixed(2);
    const fee = await TransactionFee.create(
      [{
        transactionId: newTransaction[0]._id,
        amount: feeAmount,
        currency,
        type: "processing",
      }],
      { session }
    );

    // Deduct fee from wallet
    const updatedBalanceAfterFee = parseFloat(wallet.balance.toString()) - parseFloat(feeAmount);
    wallet.balance = updatedBalanceAfterFee.toFixed(2);
    await wallet.save({ session });

    // Step 8: Create AuditLog
    await AuditLog.create(
      [{
        performed_by: userId,
        action: `Purchased ${type} insurance`,
        entity_type: "User",
        entity_id: userId,
        details: `Premium: ${premium} ${currency}, Policy ID: ${newPolicy[0]._id}`,
      }],
      { session }
    );

    // Step 9: Send Notification
    await Notification.create(
      [{
        userId,
        message: `Your ${type} insurance policy has been successfully purchased.`,
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Insurance policy created successfully.",
      policyId: newPolicy[0]._id,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.getInsurancePolicies = async (req, res) => {
    try {
      const { status, type } = req.query;
  
      const filter = { userId: req.user.id };
  
      if (status) {
        filter.status = status;
      }
      if (type) {
        filter.type = type;
      }
  
      const policies = await InsurancePolicy.find(filter).select("_id type premium status claims");
  
      if (!policies || policies.length === 0) {
        return res.status(404).json({ message: "No policies found." });
      }
  
      res.status(200).json({ policies });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error." });
    }
  };


  exports.fileInsuranceClaim = async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;
  
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount." });
      }
  
      const policy = await InsurancePolicy.findOne({ _id: id, userId: req.user.id });
  
      if (!policy) {
        return res.status(404).json({ message: "Insurance policy not found." });
      }
  
      if (policy.status !== "active") {
        return res.status(403).json({ message: "Policy expired." });
      }
  
      const claimId = uuidv4(); // unique claim ID
  
      const newClaim = {
        claimId,
        amount,
        status: "pending",
        createdAt: new Date()
      };
  
      policy.claims.push(newClaim);
      await policy.save();
  
      // Notify Admin (you can expand who admin is later)
      await Notification.create({
        userId: "admin",
        message: `New claim filed for policy ID ${id}. Claim ID: ${claimId}, Amount: ${amount}`
      })
  
      // Audit log
      await AuditLog.create({
        performed_by: req.user.id,
        action: "Filed insurance claim",
        entity_type: "InsurancePolicy",
        entity_id: policy._id,
        details: `Claim ID ${claimId} filed with amount ${amount}`
      });
  
      res.status(201).json({ claimId });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error." });
    }
  };