const { SIP, Investment, AuditLog, Transaction, TransactionFee, Wallet, Notification } = require("../models/Users"); // Your SIPSchema

exports.createSIP = async (req, res) => {
  try {
    const { investmentId, amount, frequency, startDate } = req.body;

    // Check for missing fields
    if (!investmentId || !amount || !frequency || !startDate) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Validate frequency
    const validFrequencies = ["monthly", "quarterly"];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({ message: "Invalid frequency." });
    }

    // Check investment belongs to the user
    const investment = await Investment.findOne({
      _id: investmentId,
      userId: req.user.id,
    });
    if (!investment) {
      return res
        .status(403)
        .json({ message: "You don't own this investment." });
    }

    // Create SIP
    const newSIP = new SIP({
      userId: req.user.id,
      investmentId,
      amount,
      frequency,
      startDate,
      status: "active",
    });

    await newSIP.save();

    // Log to AuditLog
    await AuditLog.create({
      performed_by: req.user.id,
      action: "Create SIP",
      entity_id: newSIP._id,
      details: `Started a ${frequency} SIP for investment ${investmentId}`,
      timestamp: new Date(),
    });

    res.status(201).json({ sipId: newSIP._id });
  } catch (error) {
    console.error("Error creating SIP:", error);
    res.status(500).json({ message: "Server error." });
  }
};


exports.paySIPInstallment = async (req, res) => {
    try {
      const sipId = req.params.id;
      const { amount, walletId } = req.body;
  
      if (!amount || !walletId) {
        return res.status(400).json({ message: 'Amount and walletId are required.' });
      }
  
      // Find SIP and check ownership + status
      const sip = await SIP.findOne({ _id: sipId, userId: req.user.id });
      if (!sip) {
        return res.status(404).json({ message: 'SIP not found.' });
      }
      if (sip.status !== 'active') {
        return res.status(403).json({ message: 'SIP is not active.' });
      }
  
      // Validate amount
      if (amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount.' });
      }
  
      // Find Wallet
      const wallet = await Wallet.findOne({ _id: walletId, userId: req.user.id });
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found.' });
      }
  
      // Calculate processing fee (1% of amount)
      const processingFee = amount * 0.01;
      const totalDeduct = amount + processingFee;
  
      if (wallet.balance < totalDeduct) {
        return res.status(400).json({ message: 'Insufficient wallet balance.' });
      }
  
      // Deduct amount + fee from wallet
      wallet.balance -= totalDeduct;
      await wallet.save();
  
      // Update Investment amount
      const investment = await Investment.findById(sip.investmentId);
      if (investment) {
        investment.amount += amount;
        await investment.save();
      }
  
      // Create Transaction (type: payment)
      const transaction = await Transaction.create({
        userId: req.user.id,
        amount: totalDeduct,
        type: 'payment',
        sipId: sip._id,
        status: 'completed',
        createdAt: new Date()
      });
  
      // Create TransactionFee
      await TransactionFee.create({
        transactionId: transaction._id,
        amount: processingFee,
        type: 'processing',
        currency: wallet.currency,
      });
  
      // Log to AuditLog
      await AuditLog.create({
        performed_by: req.user.id,
        action: 'SIP Payment',
        entity_id: transaction._id,
        details: `Paid $${amount} for SIP installment. Transaction ID: ${transaction._id}`,
        timestamp: new Date()
      });
  
      // (Optional) Notify user
      if (Notification) {
        await Notification.create({
            userId: req.user.id,
            message: `SIP payment of $${amount} was successful. Transaction ID: ${transaction._id}`,
            type: 'sip_payment',
            createdAt: new Date()
        });
      }
  
      res.status(201).json({ transactionId: transaction._id });
  
    } catch (error) {
      console.error('Error processing SIP payment:', error);
      res.status(500).json({ message: 'Server error.' });
    }
  };