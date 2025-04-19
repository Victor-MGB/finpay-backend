const { BillPayment, Wallet, TransactionFee, Transaction }= require("../models/Users");
const { v4: uuidv4 } = require("uuid"); // for generating unique references

exports.payBill = async (req, res) => {
  try {
    const userId = req.user._id;
    const { billerId, billerType, accountNumber, amount, currency } = req.body;

    // Step 0: Validate input
    if (!billerId || !billerType || !accountNumber || !amount || !currency) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Step 1: Fetch user wallet
    const wallet = await Wallet.findOne({ userId, currency });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found for this currency." });
    }

    const processingFee = parseFloat((amount * 0.015).toFixed(2));
    const totalAmount = amount + processingFee;

    // Step 2: Check for sufficient balance
    if (parseFloat(wallet.balance.toString()) < totalAmount) {
      return res.status(403).json({ message: "Insufficient balance in wallet." });
    }

    // Step 3: Create BillPayment (initially pending)
    const billPayment = new BillPayment({
      userId,
      billerId,
      billerType,
      accountNumber,
      amount,
      currency,
      status: "pending",
    });
    await billPayment.save();

    // Step 4: Create Transaction
    const transaction = new Transaction({
      senderId: userId,
      amount,
      currency,
      type: "payment",
      status: "completed",
      reference: uuidv4(),
      description: `Bill payment to ${billerType}`,
      completedAt: new Date(),
    });
    await transaction.save();

    // Step 5: Link Transaction to BillPayment and update status to completed
    billPayment.transactionId = transaction._id;
    billPayment.status = "completed";
    await billPayment.save();

    // Step 6: Deduct totalAmount from wallet
    wallet.balance = parseFloat(wallet.balance.toString()) - totalAmount;
    await wallet.save();

    // Step 7: Create TransactionFee
    const fee = new TransactionFee({
      transactionId: transaction._id,
      amount: processingFee,
      currency,
      type: "processing",
    });
    await fee.save();

    // Step 8: Send notification (optional/mock logic)
    await Notification.create({
      userId,
      message: `Bill payment to ${billerType} was successful. `,
    });

    return res.status(201).json({ billPaymentId: billPayment._id });
  } catch (err) {
    console.error("Bill payment error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// controller
exports.getBillPayments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { billerType, status } = req.query;

    // Build dynamic filter
    const filter = { userId };
    if (billerType) filter.billerType = billerType.toLowerCase();
    if (status) filter.status = status.toLowerCase();

    // Fetch bills and populate transaction
    const billPayments = await BillPayment.find(filter)
      .populate("transactionId")
      .sort({ createdAt: -1 });

    if (!billPayments || billPayments.length === 0) {
      return res.status(404).json({ message: "No bill payments found." });
    }

    // Format response
    const formattedBills = billPayments.map((bill) => ({
      billerType: bill.billerType,
      amount: bill.amount,
      status: bill.status,
      currency: bill.currency,
      accountNumber: bill.accountNumber,
      transactionId: bill.transactionId?._id,
      transactionRef: bill.transactionId?.reference,
      createdAt: bill.createdAt,
    }));

    return res.status(200).json({ billPayments: formattedBills });
  } catch (error) {
    console.error("Error fetching bill payments:", error);
    return res.status(500).json({ message: "Server error fetching bill payments." });
  }
};

  // controller
  exports.getBillPaymentById = async (req, res) => {
    try {
      const userId = req.user._id;
      const billPaymentId = req.params.id;
  
      const billPayment = await BillPayment.findOne({ _id: billPaymentId, userId })
        .populate("transactionId");
  
      if (!billPayment) {
        return res.status(404).json({ message: "Bill payment not found." });
      }
  
      res.status(200).json({
        billPayment: {
          billerId: billPayment.billerId,
          billerType: billPayment.billerType,
          accountNumber: billPayment.accountNumber,
          amount: billPayment.amount,
          currency: billPayment.currency,
          status: billPayment.status,
          transactionId: billPayment.transactionId?._id,
          transactionRef: billPayment.transactionId?.reference,
          createdAt: billPayment.createdAt,
        },
      });
    } catch (error) {
      console.error("Error fetching bill payment:", error);
      res.status(500).json({ message: "Server error fetching bill payment." });
    }
  };

  
  exports.cancelPendingBillPayment = async (req, res) => {
    try {
      const userId = req.user._id;
  
      // Find the pending bill payment
      const billPayment = await BillPayment.findOne({
        _id: req.params.id,
        userId,
        status: "pending",
      });
  
      if (!billPayment) {
        return res.status(404).json({ message: "Bill payment not found or cannot be cancelled" });
      }
  
      // Fetch related transaction
      const transaction = await Transaction.findById(billPayment.transactionId);
  
      // Refund wallet only if the transaction was completed
      if (transaction && transaction.status === "completed") {
        const wallet = await Wallet.findOne({ userId, currency: billPayment.currency });
  
        if (!wallet) {
          return res.status(404).json({ message: "Wallet not found for refund" });
        }
  
        // Add amount back to wallet
        wallet.balance = parseFloat(wallet.balance.toString()) + billPayment.amount;
        await wallet.save();
  
        // Mark original transaction as refunded
        transaction.status = "refunded";
        await transaction.save();
  
        // Create refund transaction (optional but recommended for record)
        await Transaction.create({
          senderId: null,
          receiverId: userId,
          amount: billPayment.amount,
          currency: billPayment.currency,
          status: "completed",
          type: "refund",
          reference: `refund-${Date.now()}`,
          description: `Refund for cancelled bill payment ${billPayment._id}`,
        });
      }
  
      // Delete the bill payment
      await BillPayment.findByIdAndDelete(req.params.id);
  
      res.status(200).json({ message: "Bill payment cancelled and refunded successfully" });
  
    } catch (err) {
      console.error("Cancel Bill Payment Error:", err);
      res.status(500).json({ message: "Error cancelling bill payment" });
    }
  };  
  