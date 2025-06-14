const mongoose = require("mongoose");
const {Wallet,
    Transaction,
    TransactionFee,
    Notification,
    AuditLog,
    TaxPayment
} = require("../models/Users");
const cloudinary = require("../config/cloudinary"); // Import cloudinary config

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


  // Controller: Upload Tax Document
exports.uploadTaxDocument = async (req, res) => {
    try {
      const userId = req.user._id;
      let { type, documentUrl, taxYear } = req.body;
  
      // Validate type
      if (!["receipt", "return"].includes(type)) {
        return res.status(400).json({ message: "Invalid type. Must be 'receipt' or 'return'." });
      }
  
      // Validate taxYear
      if (!taxYear || typeof Number(taxYear) !== 'number') {
        return res.status(400).json({ message: "Invalid taxYear." });
      }
  
      // Handle file upload if file is sent
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "tax_documents"
        });
        documentUrl = result.secure_url;
      }
  
      if (!documentUrl) {
        return res.status(400).json({ message: "Document URL is required." });
      }
  
      // Save Tax Document
      const taxDocument = new TaxDocument({
        userId,
        type,
        documentUrl,
        taxYear,
      });
      await taxDocument.save();
  
      // Log Audit
      await AuditLog.create({
        performed_by: userId,
        action: `Uploaded a tax ${type}`,
        entity_type: "TaxDocument",
        entity_id: taxDocument._id,
        details: `Uploaded tax ${type} for year ${taxYear}`
      });
  
      return res.status(201).json({ documentId: taxDocument._id });
  
    } catch (error) {
      console.error("Tax document upload error:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  };

  // Controller: Get Tax Payments
exports.getTaxPayments = async (req, res) => {
    try {
      const userId = req.user._id;
      const { taxYear, status } = req.query;
  
      // Build query
      let query = { userId };
      if (taxYear) query.taxYear = taxYear;
      if (status) query.status = status;
  
      const payments = await TaxPayment.find(query)
        .populate('transactionId')
        .select('_id taxType amount taxYear status') // Only return necessary fields
        .exec();
  
      if (!payments.length) {
        return res.status(404).json({ message: "No tax payments found." });
      }
  
      return res.status(200).json({ payments });
    } catch (error) {
      console.error("Get tax payments error:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  };


  // Controller: Get Tax Documents
exports.getTaxDocuments = async (req, res) => {
    try {
      const userId = req.user._id;
      const { taxYear, type } = req.query;
  
      // Build query
      let query = { userId };
      if (taxYear) query.taxYear = taxYear;
      if (type) query.type = type;
  
      const documents = await TaxDocument.find(query)
        .select('_id type documentUrl taxYear') // Only select required fields
        .exec();
  
      if (!documents.length) {
        return res.status(404).json({ message: "No tax documents found." });
      }
  
      return res.status(200).json({ documents });
    } catch (error) {
      console.error("Get tax documents error:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  };