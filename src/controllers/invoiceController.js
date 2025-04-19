const { Invoice, Notification, Transaction, TransactionFee, Wallet} = require("../models/Users"); // Assuming Invoice model exists
const { v4: uuidv4 } = require("uuid");

exports.createInvoice = async (req, res) => {
    try {
        const { receiverId, amount, currency, dueDate, items } = req.body;

        // Validate the input
        if (!receiverId || !amount || !currency || !dueDate || !items) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // Generate unique reference
        const reference = `INV-${uuidv4()}`;

        // Create new invoice
        const newInvoice = new Invoice({
            senderId: req.user.id,  // Use the authenticated user's ID
            receiverId,
            amount,
            currency,
            dueDate,
            items,
            reference,
            status: "unpaid",  // Default status is "unpaid"
        });

        await newInvoice.save();

        // Create a notification for the receiver
        const notification = new Notification({
            userId: receiverId,
            message: `You have received a new invoice (${reference}) from ${req.user.id}.`,
            isRead: false,  // Notification is unread by default
        });

        await notification.save();

        return res.status(201).json({ invoiceId: newInvoice._id, reference });
    } catch (error) {
        console.error("Error creating invoice:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

exports.payInvoice = async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentMethodId } = req.body;
  
      // Step 1: Verify invoice exists and belongs to the receiver
      const invoice = await Invoice.findById(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found." });
      }
  
      if (invoice.receiverId.toString() !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to pay this invoice." });
      }
  
      // Step 2: Find payer's wallet
      const payerWallet = await Wallet.findOne({ userId: req.user.id, currency: invoice.currency });
      if (!payerWallet) {
        return res.status(404).json({ message: "Payer wallet not found." });
      }
  
      // Step 3: Calculate fees
      const processingFee = parseFloat((invoice.amount * 0.025).toFixed(2)); // 2.5% fee
      let currencyConversionFee = 0;
  
      if (payerWallet.currency !== invoice.currency) {
        currencyConversionFee = parseFloat((invoice.amount * 0.03).toFixed(2)); // 3% currency conversion fee
      }
  
      const totalFee = processingFee + currencyConversionFee;
      const totalAmount = invoice.amount + totalFee;
  
      // Step 4: Check if payer has enough balance
      if (payerWallet.balance < totalAmount) {
        return res.status(400).json({ message: "Insufficient balance." });
      }
  
      // Step 5: Deduct totalAmount from payer's wallet
      const updatedPayerWallet = await Wallet.findOneAndUpdate(
        { userId: req.user.id, currency: invoice.currency },
        { $inc: { balance: -totalAmount } },
        { new: true }
      );
  
      if (!updatedPayerWallet) {
        return res.status(500).json({ message: "Failed to update payer wallet." });
      }
  
      // Step 6: Credit the invoice amount to the sender's wallet
      const updatedSenderWallet = await Wallet.findOneAndUpdate(
        { userId: invoice.senderId, currency: invoice.currency },
        { $inc: { balance: invoice.amount } },
        { new: true }
      );
  
      if (!updatedSenderWallet) {
        return res.status(500).json({ message: "Failed to update sender wallet." });
      }
  
      // Step 7: Create a transaction record
      const transactionReference = `TXN-${uuidv4()}`;
      const transaction = new Transaction({
        senderId: req.user.id,
        receiverId: invoice.senderId,
        amount: invoice.amount,
        currency: invoice.currency,
        status: "completed",
        type: "payment",
        paymentMethodId,
        reference: transactionReference,
        description: `Payment for invoice ${invoice.reference}`,
      });
  
      await transaction.save();
  
      // Step 8: Create fee records if applicable
      if (processingFee > 0) {
        await new TransactionFee({
          transactionId: transaction._id,
          amount: processingFee,
          currency: invoice.currency,
          type: "processing",
        }).save();
      }
  
      if (currencyConversionFee > 0) {
        await new TransactionFee({
          transactionId: transaction._id,
          amount: currencyConversionFee,
          currency: invoice.currency,
          type: "currency_conversion",
        }).save();
      }
  
      // Step 9: Mark the invoice as paid
      invoice.status = "paid";
      await invoice.save();
  
      // Step 10: Notify the sender
      await new Notification({
        userId: invoice.senderId,
        message: `Your invoice (${invoice.reference}) has been paid.`,
        isRead: false,
      }).save();
  
      // Step 11: Respond to client
      return res.status(200).json({ message: "Invoice paid successfully" });
    } catch (error) {
      console.error("Error processing payment:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  exports.getInvoices = async (req, res) => {
    try {
      const { status } = req.query;
  
      // Find invoices where user is either sender or receiver
      const filter = {
        $or: [{ senderId: req.user.id }, { receiverId: req.user.id }],
      };
  
      // If a status is provided, add it to the filter
      if (status) {
        filter.status = status;
      }
  
      // Fetch invoices and populate senderId and receiverId fields
      const invoices = await Invoice.find(filter)
        .populate("senderId", "name email") // Populate sender details
        .populate("receiverId", "name email") // Populate receiver details
        .sort({ createdAt: -1 }); // Sort by newest first
  
      return res.status(200).json({ invoices });
    } catch (error) {
      console.error("Error fetching invoices:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  exports.getInvoiceById = async (req, res) => {
    try {
      const { id } = req.params;
  
      // Fetch the invoice by ID and populate senderId and receiverId details
      const invoice = await Invoice.findById(id)
        .populate("senderId", "name email") // Populate sender details
        .populate("receiverId", "name email"); // Populate receiver details
  
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found." });
      }
  
      // Ensure the authenticated user is either the sender or receiver
      if (
        invoice.senderId._id.toString() !== req.user.id &&
        invoice.receiverId._id.toString() !== req.user.id
      ) {
        return res.status(403).json({ message: "Access denied." });
      }
  
      return res.status(200).json({ invoice });
    } catch (error) {
      console.error("Error fetching invoice:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };