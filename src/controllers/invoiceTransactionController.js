const { User, Invoice, Transaction } = require("../models/Users");
const PDFDocument = require("pdfkit");

// Create a new invoice
exports.createInvoice = async (req, res) => {
  try {
    const { receiverId, amount, currency, dueDate, items } = req.body;
    const senderId = req.user._id;

    //Ensure receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    //Generate unique reference
    const reference = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    //Create invoice
    const invoice = new Invoice({
      senderId,
      receiverId,
      amount,
      currency,
      dueDate,
      items,
      reference,
    });

    //Save invoice
    await invoice.save();

    return res
      .status(201)
      .json({ message: "Invoice created successfully", invoice });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

//get Users's Invoice
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ senderId: req.user._id }).populate(
      "receiverId",
      "fullName email"
    );
    return res.status(200).json({ invoices });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

//Update Invoice status
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["unpaid", "paid", "overdue"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found", invoice });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

//Generate invoice PDF
exports.generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id).populate(
      "senderId receiverId",
      "fullName email"
    );

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const doc = new PDFDocument();
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice.reference}.pdf`
    );
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);
    doc
      .fontSize(20)
      .text(`Invoice: ${invoice.reference}`, { align: "center" })
      .moveDown();
    doc
      .fontSize(14)
      .text(`Sender: ${invoice.senderId.fullName} (${invoice.senderId.email})`);
    doc
      .text(
        `Receiver: ${invoice.receiverId.fullName} (${invoice.receiverId.email})`
      )
      .moveDown();
    doc.fontSize(12).text(`Amount: ${invoice.currency} ${invoice.amount}`);

    doc.text(`Due Date: ${invoice.dueDate}`);
    doc.text(`Status: ${invoice.status}`);
    doc.end();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

//Create a new transaction
exports.createTransaction = async (req, res) => {
  try {
    const { walletId, amount, currency, transactionType, paymentGateWay } =
      req.body;
    const userId = req.user.id;

    const reference = `TRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const transaction = new Transaction({
      userId,
      walletId,
      amount,
      currency,
      transactionType,
      paymentGateWay,
      reference,
    });
    await transaction.save();

    return res
      .status(201)
      .json({ message: "Transaction created successfully", transaction });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

//get Users's transaction
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user._id,
    }).populate("walletId", "name");
    return res.status(200).json({ transactions });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
