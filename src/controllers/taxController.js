const mongoose = require("mongoose");
const {Wallet,
    Transaction,
    TransactionFee,
    Notification,
    AuditLog,
    TaxPayment
} = require("../models/Users");

exports.createTaxPayment = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const { taxType, amount, currency, taxYear, walletId } = req.body;
      const userId = req.user._id; // Assuming you have user data from authentication middleware
  
      // 1. Validate taxType
      if (!["income", "property"].includes(taxType)) {
        return res.status(400).json({ message: "Invalid taxType." });
      }
  
      // 2. Validate taxYear
      const currentYear = new Date().getFullYear();
      if (taxYear < 2000 || taxYear > currentYear) {
        return res.status(400).json({ message: "Invalid taxYear." });
      }
  
      // 3. Fetch Wallet
      const wallet = await Wallet.findById(walletId).session(session);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found." });
      }
  
      if (wallet.currency !== currency) {
        return res.status(400).json({ message: "Currency mismatch with wallet." });
      }
  
      // 4. Check balance
      const walletBalance = parseFloat(wallet.balance.toString());
      if (walletBalance < amount) {
        return res.status(403).json({ message: "Insufficient balance." });
      }
  
      // 5. Create TaxPayment with status "pending"
      const taxPayment = await TaxPayment.create(
        [{
          userId,
          taxType,
          amount,
          currency,
          taxYear,
          status: "pending",
        }],
        { session }
      );
  
      // 6. Deduct tax amount from Wallet
      wallet.balance = (walletBalance - amount).toFixed(2);
      await wallet.save({ session });
  
      // 7. Create Transaction (type: payment)
      const transaction = await Transaction.create(
        [{
          senderId: userId,
          amount,
          currency,
          status: "completed",
          type: "payment",
          reference: `TAXPAY-${Date.now()}`,
          description: `Tax payment for ${taxType} tax year ${taxYear}`,
          completedAt: new Date(),
        }],
        { session }
      );
  
      // 8. Update TaxPayment with transactionId and mark status completed
      taxPayment[0].transactionId = transaction[0]._id;
      taxPayment[0].status = "completed";
      await taxPayment[0].save({ session });
  
      // 9. Apply processing fee (1% of amount)
      const processingFeeAmount = (0.01 * amount).toFixed(2);
  
      if (processingFeeAmount > 0) {
        // Deduct fee from wallet
        const newWalletBalance = parseFloat(wallet.balance.toString()) - parseFloat(processingFeeAmount);
        if (newWalletBalance < 0) {
          throw new Error("Insufficient balance to pay processing fee.");
        }
        wallet.balance = newWalletBalance.toFixed(2);
        await wallet.save({ session });
  
        // Create TransactionFee
        await TransactionFee.create(
          [{
            transactionId: transaction[0]._id,
            amount: processingFeeAmount,
            currency,
            type: "processing",
          }],
          { session }
        );
      }
  
      // 10. Create Notification
      await Notification.create(
        [{
          userId,
          message: `Your tax payment for ${taxType} tax year ${taxYear} was successful.`,
        }],
        { session }
      );
  
      // 11. Create AuditLog
      await AuditLog.create(
        [{
          performed_by: userId,
          action: `Paid ${taxType} tax for year ${taxYear}`,
          entity_type: "Transaction",
          entity_id: transaction[0]._id,
          details: `Tax payment of ${amount} ${currency} was processed.`,
        }],
        { session }
      );
  
      await session.commitTransaction();
      session.endSession();
  
      return res.status(201).json({ paymentId: taxPayment[0]._id });
  
    } catch (error) {
      console.error(error);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  };