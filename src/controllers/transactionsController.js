const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const {
  Wallet,
  Transaction,
  TransactionFee,
  AuditLog,
  Notification,
  PaymentMethod,
  CurrencyConversion
} = require("../models/Users");


exports.sendPayment = async (req, res) => {
  try {
    const { receiverId, amount, currency, paymentMethodId, description } =
      req.body;
    const senderId = req.user.id; // Assuming you have a middleware that sets req.user

    if (!receiverId || !amount || !currency) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot send money to yourself" });
    }

    //fetch sender and receiver wallets
    const senderWallet = await Wallet.findOne({ userId: senderId, currency });
    const receiverWallet = await Wallet.findOne({
      userId: receiverId,
      currency,
    });

    if (!senderWallet) {
      return res.status(404).json({ message: "Sender wallet not found" });
    }

    if (!receiverWallet) {
      return res.status(404).json({ message: "Receiver wallet not found" });
    }

    //unique  transaction reference
    const reference = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    //check sender balance
    if (senderWallet.balance < amount) {
      //Deduct from sender's wallet
      senderWallet.balance -= amount;
      await senderWallet.save();

      //Add to receiver's Wallet
      receiverWallet.balance += amount;
      await receiverWallet.save();
    } else {
      if (!paymentMethodId) {
        return res
          .status(400)
          .json({ message: "Please provide a payment method" });
      }

      //charge via stripe
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      if (!paymentMethod) {
        return res.status(404).json({ message: "Payment method not found" });
      }

      const charge = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Amount in cents
        currency,
        payment_method: paymentMethod.token,
        confirm: true,
      });

      if (charge.status !== "succeeded") {
        return res.status(400).json({ message: "Payment failed" });
      }
    }

    //create transaction record
    const transaction = await Transaction.create({
      senderId,
      receiverId,
      amount,
      currency,
      type: "payment",
      status: "pending",
      paymentMethodId: paymentMethodId || null,
      reference,
      description,
    });

    //calculate and save transaction fee
    const feeAmount = amount * 0.02;
    await TransactionFee.create({
      transactionId: transaction._id,
      amount: feeAmount,
      currency,
      type: "processing",
    });

    //update transaction to completed
    transaction.status = "completed";
    transaction.completeAt = new Date();
    await transaction.save();

    //Audit Log
    await AuditLog.create({
      performed_by: senderId,
      action: "Payment Sent",
      entity_type: "Transaction",
      entity_id: transaction._id,
      details: `Payment of ${amount} ${currency} sent to ${receiverId}.`,
    });

    //Notify Receiver
    await Notification.create({
      userId: receiverId,
      type: "payment_received",
      message: `You have received ${amount} ${currency} from ${senderId}.`,
      reference: transaction._id,
    });

    //Notify Sender
    await Notification.create({
      userId: senderId,
      type: "payment_sent",
      message: `You have sent ${amount} ${currency} to ${receiverId}.`,
      reference: transaction._id,
    });

    res
      .status(200)
      .json({
        message: "Payment sent successfully",
        transactionId: transaction._id,
      });
  } catch (error) {
    console.error("Error sending payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.transferFunds = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const { fromWalletId, toWalletId, amount } = req.body;
      const userId = req.user._id; // Authenticated user
  
      if (!fromWalletId || !toWalletId || !amount) {
        return res.status(400).json({ message: "Missing required fields." });
      }
  
      if (fromWalletId === toWalletId) {
        return res.status(400).json({ message: "Cannot transfer to the same wallet." });
      }
  
      // Convert amount to Decimal128 to maintain precision
      const transferAmount = mongoose.Types.Decimal128.fromString(amount.toString());
  
      // Fetch both wallets with session to ensure atomicity
      const fromWallet = await Wallet.findOne({ _id: fromWalletId, userId }).session(session);
      const toWallet = await Wallet.findOne({ _id: toWalletId, userId }).session(session);
  
      if (!fromWallet || !toWallet) {
        await session.abortTransaction();
        return res.status(404).json({ message: "One or both wallets not found." });
      }
  
      if (fromWallet.balance < transferAmount) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Insufficient funds." });
      }
  
      let feeAmount = mongoose.Types.Decimal128.fromString("0");
      let convertedAmount = transferAmount;
      let metadata = {};
  
      // Handle currency conversion if needed
      if (fromWallet.currency !== toWallet.currency) {
        const conversionRate = await CurrencyConversion.findOne({
          from: fromWallet.currency,
          to: toWallet.currency,
        }).session(session);
  
        if (!conversionRate) {
          await session.abortTransaction();
          return res.status(400).json({ message: "Currency conversion rate not found." });
        }
  
        // Calculate converted amount
        convertedAmount = mongoose.Types.Decimal128.fromString(
          (parseFloat(amount) * conversionRate.rate).toFixed(2)
        );
  
        // Apply a 1.5% conversion fee
        feeAmount = mongoose.Types.Decimal128.fromString((parseFloat(amount) * 0.015).toFixed(2));
  
        metadata = {
          conversion_rate: conversionRate.rate,
          original_amount: amount,
          converted_amount: convertedAmount,
          conversion_fee: feeAmount,
        };
      }
  
      // Deduct funds from sender (amount + fee)
      fromWallet.balance = mongoose.Types.Decimal128.fromString(
        (parseFloat(fromWallet.balance) - parseFloat(amount) - parseFloat(feeAmount)).toFixed(2)
      );
  
      // Credit receiver
      toWallet.balance = mongoose.Types.Decimal128.fromString(
        (parseFloat(toWallet.balance) + parseFloat(convertedAmount)).toFixed(2)
      );
  
      await fromWallet.save({ session });
      await toWallet.save({ session });
  
      // Create transaction
      const transaction = new Transaction({
        senderId: userId,
        receiverId: userId,
        amount: transferAmount,
        currency: fromWallet.currency,
        type: "transfer",
        status: "completed",
        reference: `TXN_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        metadata,
      });
  
      await transaction.save({ session });
  
      // Attach transaction to both wallets
      fromWallet.transactions.push(transaction._id);
      toWallet.transactions.push(transaction._id);
      await fromWallet.save({ session });
      await toWallet.save({ session });
  
      // Save fee if applicable
      if (parseFloat(feeAmount) > 0) {
        const transactionFee = new TransactionFee({
          transactionId: transaction._id,
          amount: feeAmount,
          currency: fromWallet.currency,
          type: "currency_conversion",
        });
        await transactionFee.save({ session });
      }
  
      // Log transfer in AuditLog
      await AuditLog.create(
        [
          {
            performed_by: userId,
            action: "Transferred funds",
            entity_type: "Transaction",
            entity_id: transaction._id,
            details: `Transferred ${amount} ${fromWallet.currency} from wallet ${fromWalletId} to wallet ${toWalletId}`,
          },
        ],
        { session }
      );
  
      await session.commitTransaction();
      session.endSession();
  
      return res.status(200).json({ transactionId: transaction._id, message: "Transfer successful." });
  
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Transfer error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };


  exports.refundTransaction = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const { transactionId, metadata } = req.body;
      const userId = req.user._id; // Authenticated user
  
      if (!transactionId) {
        return res.status(400).json({ message: "Transaction ID is required." });
      }
  
      // Fetch original transaction
      const originalTransaction = await Transaction.findOne({
        _id: transactionId,
        senderId: userId, // Must be initiated by the authenticated user
        status: "completed",
      }).session(session);
  
      if (!originalTransaction) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Transaction not found or not refundable." });
      }
  
      // Ensure transaction is not already refunded
      if (originalTransaction.status === "refunded") {
        await session.abortTransaction();
        return res.status(400).json({ message: "Transaction already refunded." });
      }
  
      const { amount, currency, receiverId, senderId, paymentMethodId, stripePaymentIntentId } = originalTransaction;
  
      let refundFee = mongoose.Types.Decimal128.fromString("0");
      let refundAmount = mongoose.Types.Decimal128.fromString(amount.toString());
  
      // If paid via Stripe, process Stripe refund
      if (stripePaymentIntentId) {
        const stripeRefund = await stripe.refunds.create({
          payment_intent: stripePaymentIntentId,
          amount: Math.round(amount * 100), // Stripe handles amounts in cents
        });
  
        if (stripeRefund.status !== "succeeded") {
          await session.abortTransaction();
          return res.status(500).json({ message: "Stripe refund failed." });
        }
  
        console.log(`✅ Stripe Refund Success: ${stripeRefund.id}`);
  
        // Apply Stripe processing fee ($0.50 per refund)
        refundFee = mongoose.Types.Decimal128.fromString("0.50");
        refundAmount = mongoose.Types.Decimal128.fromString(
          (parseFloat(amount) - 0.50).toFixed(2)
        );
      }
  
      // Fetch wallets
      const senderWallet = await Wallet.findOne({ userId: receiverId, currency }).session(session);
      const receiverWallet = await Wallet.findOne({ userId: senderId, currency }).session(session);
  
      if (!senderWallet || !receiverWallet) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Wallets not found." });
      }
  
      // Ensure sender has enough balance for the refund
      if (parseFloat(senderWallet.balance) < parseFloat(refundAmount)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Insufficient funds for refund." });
      }
  
      // Process internal wallet refund
      senderWallet.balance = mongoose.Types.Decimal128.fromString(
        (parseFloat(senderWallet.balance) - parseFloat(refundAmount)).toFixed(2)
      );
  
      receiverWallet.balance = mongoose.Types.Decimal128.fromString(
        (parseFloat(receiverWallet.balance) + parseFloat(refundAmount)).toFixed(2)
      );
  
      await senderWallet.save({ session });
      await receiverWallet.save({ session });
  
      // Create refund transaction
      const refundTransaction = new Transaction({
        senderId: receiverId,
        receiverId: senderId,
        amount: refundAmount,
        currency,
        type: "refund",
        status: "completed",
        reference: `RFND_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        metadata,
      });
  
      await refundTransaction.save({ session });
  
      // Attach refund transaction to wallets
      senderWallet.transactions.push(refundTransaction._id);
      receiverWallet.transactions.push(refundTransaction._id);
      await senderWallet.save({ session });
      await receiverWallet.save({ session });
  
      // Update original transaction status
      originalTransaction.status = "refunded";
      await originalTransaction.save({ session });
  
      // Save refund fee if applicable
      if (parseFloat(refundFee) > 0) {
        const transactionFee = new TransactionFee({
          transactionId: refundTransaction._id,
          amount: refundFee,
          currency,
          type: "processing",
        });
        await transactionFee.save({ session });
      }
  
      // Log refund in AuditLog
      await AuditLog.create(
        [
          {
            performed_by: userId,
            action: "Refunded transaction",
            entity_type: "Transaction",
            entity_id: refundTransaction._id,
            details: `Refunded ${amount} ${currency} for transaction ${transactionId}`,
          },
        ],
        { session }
      );
  
      await session.commitTransaction();
      session.endSession();
  
      // Notify receiver (Future improvement: Implement email/notification service)
      console.log(`📢 User ${receiverId} notified: Refund of ${refundAmount} ${currency} processed.`);
  
      return res.status(200).json({ refundTransactionId: refundTransaction._id, message: "Refund successful." });
  
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Refund error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  exports.listTransactions = async (req, res) => {
    try {
      const userId = req.user._id; // Authenticated user
      const { status, type, currency, page = 1, limit = 10 } = req.query; // Pagination + Filters
  
      const query = {
        $or: [{ senderId: userId }, { receiverId: userId }],
      };
  
      // Apply filters if provided
      if (status) query.status = status;
      if (type) query.type = type;
      if (currency) query.currency = currency;
  
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
  
      // Fetch transactions with pagination & payment method details
      const transactions = await Transaction.find(query)
        .populate("paymentMethodId")
        .sort({ createdAt: -1 }) // Sort newest first
        .skip((pageNumber - 1) * limitNumber) // Skip previous pages
        .limit(limitNumber); // Limit results per page
  
      // Count total transactions for pagination info
      const totalTransactions = await Transaction.countDocuments(query);
  
      return res.status(200).json({
        transactions,
        pagination: {
          total: totalTransactions,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalTransactions / limitNumber),
        },
      });
  
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };


  //get a specific user Id
  exports.getTransactionById = async (req, res) => {
    try{
        const userId = req.user._id; // Authenticated user
        const { Id } = req.params; //Transaction ID from URl

        //Fetch transaction & populate related fields
        const transaction = await Transaction.findById(id)
      .populate("senderId", "name email") // Fetch sender details
      .populate("receiverId", "name email") // Fetch receiver details
      .populate("paymentMethodId") // Fetch payment method details
      .lean(); // Convert Mongoose document to plain JSON object

      if(!transaction){
        return res.status(404).json({message: "Transaction not found"});
      }

      //Ensure the user is involved in the transaction
      if (
        transaction.senderId._id.toString() !== userId.toString() &&
        transaction.receiverId._id.toString() !== userId.toString()
      ) {
        return res.status(403).json({ message: "Unauthorized to view this transaction." });
      }

      //Fetch transaction fees related to this transaction
      const transactionFees = await TransactionFee.find({ transactionId: id }).lean();

      //Add fess to transaction response
        transaction.fees = transactionFees;
    }catch(error){
        console.error("Error fetching transaction:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
    }



    //externally off point
    exports.P2P = async (req, res) => {
      try {
        const { receiverId, amount, currency, paymentMethodId } = req.body;
        const userId = req.user.id; // Authenticated user
    
        // Validate Sender Wallet or Payment Method
        const senderWallet = await Wallet.findOne({ userId, currency });
        if (!senderWallet || parseFloat(senderWallet.balance) < amount) {
          return res.status(400).json({ message: "Insufficient funds" });
        }
    
        // Validate Receiver
        const receiverWallet = await Wallet.findOne({ userId: receiverId, currency });
        if (!receiverWallet) {
          return res.status(404).json({ message: "Receiver not found" });
        }
    
        // Determine Fees
        const processingFee = amount * 0.02; // 2% processing fee
        let currencyConversionFee = 0;
    
        // Currency Conversion Logic
        if (currency !== senderWallet.currency) {
          const conversionRate = await CurrencyConversion.findOne({
            baseCurrency: currency,
            targetCurrency: senderWallet.currency,
          });
    
          if (!conversionRate) {
            return res.status(400).json({ message: "Currency conversion rate unavailable" });
          }
    
          currencyConversionFee = amount * 0.02; // 2% conversion fee
        }
    
        const totalFee = processingFee + currencyConversionFee;
        const totalDeduction = amount + totalFee;
    
        // Deduct Sender Wallet Balance
        senderWallet.balance = parseFloat(senderWallet.balance) - totalDeduction;
        await senderWallet.save();
    
        // Credit Receiver's Wallet
        receiverWallet.balance = parseFloat(receiverWallet.balance) + amount;
        await receiverWallet.save();
    
        // Create Transaction
        const transaction = await Transaction.create({
          senderId: userId,
          receiverId,
          amount,
          currency,
          status: "completed",
          type: "payment",
          paymentMethodId,
          reference: `TX-${Date.now()}`,
          description: "P2P payment",
        });
    
        // Create Transaction Fee
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
    
        // Send Notification to Receiver
        await Notification.create({
          userId: receiverId,
          message: `You received a payment of ${amount} ${currency}`,
          type: "payment",
          reference: transaction._id,
        });
    
        // Audit Log
        await AuditLog.create({
          performed_by: userId,
          action: "Payment sent",
          entity_type: "Transaction",
          entity_id: transaction._id,
          details: `Payment of ${amount} ${currency} to user ${receiverId}`,
        });
    
        return res.status(201).json({
          message: "Payment successful",
          transactionId: transaction._id,
        });
      } catch (error) {
        console.error("Payment error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    };
    