const {TransactionFee, Transaction} = require('../models/Users');

exports.getTransactionFees = async (req, res) => {
  try {
    const userId = req.user._id; // Authenticated user
    const { transactionId } = req.params; // Transaction ID from URL

    // Fetch transaction to verify user involvement
    const transaction = await Transaction.findById(transactionId).lean();
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // Ensure user is sender or receiver
    if (
      transaction.senderId.toString() !== userId.toString() &&
      transaction.receiverId.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized to view this transaction's fees." });
    }

    // Fetch transaction fees
    const transactionFees = await TransactionFee.find({ transactionId }).lean();

    if (!transactionFees.length) {
      return res.status(404).json({ message: "No fees found for this transaction." });
    }

    return res.status(200).json({ transactionId, fees: transactionFees });

  } catch (error) {
    console.error("Error fetching transaction fees:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
