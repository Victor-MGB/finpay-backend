const {AuditLog, VirtualCard, Wallet, Transaction, TransactionFee, CreditCardApplication } = require('../models/Users'); // adjust path as needed
const sendEmail = require('../utils/sendEmail'); // Adjust the path if needed
const {v4: uuidv4} = require("uuid");

exports.applyForCreditCard = async (req, res) => {
    try {
      const { creditLimitRequested } = req.body;
  
      // Validate input
      if (!creditLimitRequested || typeof creditLimitRequested !== 'number' || creditLimitRequested <= 0) {
        return res.status(400).json({ message: 'Invalid creditLimitRequested.' });
      }
  
      // Create a new application
      const newApplication = await CreditCardApplication.create({
        userId: req.user.id,
        creditLimitRequested,
        status: 'pending',
      });
  
      // Send email to compliance team
      try {
        await sendEmail(
          'compliance-team@example.com', // Replace with actual compliance team email
          'New Credit Card Application Submitted',
          `User ID: ${req.user.id} applied for a credit card.\n\nRequested Limit: $${creditLimitRequested}\nApplication ID: ${newApplication._id}`
        );
      } catch (emailError) {
        console.error('Failed to send compliance email:', emailError.message);
      }
  
      // Log action to AuditLog
      await AuditLog.create({
        performed_by: req.user.id,
        action: 'Applied for credit card',
        entity_type: 'User',
        entity_id: req.user.id,
        details: `User applied for a credit card with limit ${creditLimitRequested}`,
      });
  
      return res.status(201).json({ applicationId: newApplication._id });
  
    } catch (error) {
      console.error('Error applying for credit card:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  };


exports.getCreditCardApplications = async (req, res) => {
  try {
    const { status } = req.query;

    // Build query object
    const query = { userId: req.user.id };
    if (status) {
      query.status = status;
    }

    // Fetch applications
    const applications = await CreditCardApplication.find(query).select('_id creditLimitRequested status');

    if (!applications || applications.length === 0) {
      return res.status(404).json({ message: 'No applications found.' });
    }

    return res.status(200).json({ applications });

  } catch (error) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.payCreditCardBalance = async (req, res) => {
  try {
    const { id } = req.params; // VirtualCard ID
    const { amount, walletId, paymentMethodId } = req.body;

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount.' });
    }

    // Find Virtual Card
    const card = await VirtualCard.findOne({ _id: id, userId: req.user.id });
    if (!card) {
      return res.status(403).json({ message: 'Forbidden. Not your card.' });
    }

    if (amount > card.balance) {
      return res.status(400).json({ message: 'Amount exceeds card balance.' });
    }

    // Find Wallet
    const wallet = await Wallet.findOne({ _id: walletId, userId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }

    // Calculate processing fee (1.5%)
    const processingFee = Number((amount * 0.015).toFixed(2));
    const totalDeduct = amount + processingFee;

    if (parseFloat(wallet.balance) < totalDeduct) {
      return res.status(400).json({ message: 'Insufficient wallet balance.' });
    }

    // Deduct from Wallet
    wallet.balance = (parseFloat(wallet.balance) - totalDeduct).toFixed(2);
    wallet.updatedAt = new Date();
    await wallet.save();

    // Update VirtualCard balance
    card.balance = (card.balance - amount).toFixed(2);
    await card.save();

    // Create Transaction
    const transaction = await Transaction.create({
      senderId: req.user.id,
      receiverId: null,
      amount,
      currency: wallet.currency,
      status: 'completed',
      type: 'payment',
      paymentMethodId: paymentMethodId || null,
      reference: uuidv4(),
      description: `Credit Card Payment for card ending ${card.cardNumber.slice(-4)}`,
      completedAt: new Date(),
      metadata: {
        cardId: card._id,
        walletId: wallet._id,
      }
    });

    // Create TransactionFee
    await TransactionFee.create({
      transactionId: transaction._id,
      amount: processingFee,
      currency: wallet.currency,
      type: 'processing',
    });

    // Log in AuditLog
    await AuditLog.create({
      performed_by: req.user.id,
      action: 'Credit Card Payment',
      entity_type: 'Transaction',
      entity_id: transaction._id,
      details: `User paid $${amount} + $${processingFee} fee from wallet ${wallet._id} towards card ${card._id}.`,
    });

    // Notify User
    await sendEmail({
      to: req.user.email,
      subject: 'Credit Card Payment Successful',
      text: `You have successfully paid $${amount} (plus $${processingFee} fee) towards your virtual credit card ending in ${card.cardNumber.slice(-4)}.`,
    });

    return res.status(201).json({ transactionId: transaction._id });

  } catch (error) {
    console.error('Error paying credit card balance:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// PATCH /admin/credit-card-applications/:id
exports.updateCreditCardApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, creditLimit } = req.body;

    // 1. Authorization check
    if (!['admin', 'compliance'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 2. Find the application
    const application = await CreditCardApplication.findById(id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // 3. Update application status
    application.status = status;
    if (status === 'approved') {
      application.approvedAt = new Date();
    }
    await application.save();

    // 4. If approved, create VirtualCard
    if (status === 'approved') {
      const maskedCardNumber = generateMaskedCardNumber(); // e.g., "****1234"
      const newCard = await VirtualCard.create({
        userId: application.userId,
        cardNumber: maskedCardNumber,
        cardHolder: req.user.name || "System",
        cardType: "Visa", // Or dynamic
        cvv: "encrypted-cvv", // encrypt and store properly
        expiryDate: generateExpiryDate(), // e.g., 3 years from now
        creditLimit: creditLimit,
        balance: 0,
        status: "active",
        network: "Visa", // or MasterCard
      });

      // Optional: Send notification to the user
      await sendNotification(application.userId, `Your credit card application was approved!`);

      // Log creation (optional)
      await AuditLog.create({
        performed_by: req.user.id,
        action: `Approved credit card application and issued card ${newCard._id}`,
        entity_id: application._id,
        entity_type: 'CreditCardApplication',
        details: "Your credit card has been approved",
        timestamp: new Date(),
      });
    }

    return res.status(200).json({ message: 'Application updated' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Helpers (example only)
function generateMaskedCardNumber() {
  const last4 = Math.floor(1000 + Math.random() * 9000).toString();
  return `****${last4}`;
}

function generateExpiryDate() {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getFullYear() + 3}`; // 3 years from today
}