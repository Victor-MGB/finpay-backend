const mongoose = require('mongoose');
const {Statement, Transaction, Wallet, AuditLog} = require('../models/Users');

exports.createStatement = async (req, res) => {
    try {
      const { walletId, periodStart, periodEnd } = req.body;
  
      // Validate date range
      if (!periodStart || !periodEnd || new Date(periodStart) > new Date(periodEnd)) {
        return res.status(400).json({ message: "Invalid date range." });
      }
  
      // Ensure wallet belongs to the authenticated user
      const wallet = await Wallet.findOne({ _id: walletId, userId: req.user.id });
      if (!wallet) {
        return res.status(403).json({ message: "You do not have access to this wallet." });
      }
  
      // Fetch transactions for this user in the date range
      const transactions = await Transaction.find({
        $or: [
          { senderId: req.user.id },
          { receiverId: req.user.id }
        ],
        createdAt: { $gte: new Date(periodStart), $lte: new Date(periodEnd) }
      }).select("_id");
  
      const transactionIds = transactions.map(tx => tx._id);
  
      // Create statement
      const newStatement = await Statement.create({
        userId: req.user.id,
        walletId,
        periodStart,
        periodEnd,
        transactions: transactionIds
      });
  
      // Log in audit
      await AuditLog.create({
        performed_by: req.user.id,
        action: "Generated Statement",
        entity_type: "User",
        entity_id: req.user.id,
        details: `Generated statement for wallet ${walletId} from ${periodStart} to ${periodEnd}`
      });
  
      return res.status(201).json({ statementId: newStatement._id });
  
    } catch (error) {
      console.error("Error creating statement:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };


  exports.getStatements = async (req, res) => {
    try {
      const { walletId, periodStart, periodEnd } = req.query;
  
      const query = {
        userId: req.user.id,
      };
  
      if (walletId) {
        query.walletId = walletId;
      }
  
      if (periodStart && periodEnd) {
        const startDate = new Date(periodStart);
        const endDate = new Date(periodEnd);
  
        if (startDate > endDate) {
          return res.status(400).json({ message: "Invalid date range." });
        }
  
        query.periodStart = { $gte: startDate };
        query.periodEnd = { $lte: endDate };
      }
  
      const statements = await Statement.find(query)
        .populate("transactions")
        .sort({ generatedAt: -1 });
  
      if (!statements.length) {
        return res.status(404).json({ message: "No statements found." });
      }
  
      return res.status(200).json({
        statements: statements.map(statement => ({
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
          transactions: statement.transactions,
        })),
      });
  
    } catch (error) {
      console.error("Error fetching statements:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };