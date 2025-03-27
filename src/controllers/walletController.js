const { User, AuditLog, Currency, Wallet } = require("../models/Users");
const updateExchangeRates = require("../services/fetchExchangeRates");

// Create a new wallet
exports.createWallet = async (req, res) => {
  try {
    const { currency } = req.body;
    const userId = req.user.id;

    // Ensure latest exchange rates before creating a wallet
    await updateExchangeRates();

    // Check if currency is supported
    const currencyExists = await Currency.findOne({ code: currency.toUpperCase() });
    if (!currencyExists) {
      return res.status(400).json({ message: "Unsupported currency" });
    }

    // Check if user already has a wallet in the given currency
    const existingWallet = await Wallet.findOne({ userId, currency });
    if (existingWallet) {
      return res.status(400).json({ message: "Wallet for this currency already exists" });
    }

    // Define if this is a FinPay wallet (example: USD is designated for FinPay)
    const isFinPayWallet = currency.toUpperCase() === "USD";

    // Create the new wallet
    const wallet = new Wallet({
      userId,
      currency,
      balance: 0,
      isFinPayWallet,
    });

    await wallet.save();

    // Update user's wallets array or set FinPay wallet
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (isFinPayWallet) {
      user.finPayWallet = wallet._id;
    } else {
      user.wallets.push(wallet._id);
    }

    await user.save();

    // Log action in AuditLog
    await AuditLog.create({
      performed_by: userId,
      action: "Wallet Created",
      entity_type: "Account",
      entity_id: wallet._id,
      details: `Wallet with currency ${currency} created.`,
    });

    res.status(201).json({ walletId: wallet._id, isFinPayWallet });
  } catch (error) {
    console.error("Error creating wallet:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all wallets
exports.getWallets = async (req, res) => {
    try {
      const userId = req.user?.id; // Ensure user ID is available
  
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized: User ID not found" });
      }
  
      // Fetch all wallets belonging to the user and populate transactions
      const wallets = await Wallet.find({ userId }).populate("transactions");
  
      // Format response
      const formattedWallets = wallets.map(wallet => ({
        currency: wallet.currency,
        balance: wallet.balance,
        transactions: wallet.transactions,
      }));
  
      res.status(200).json({ wallets: formattedWallets });
    } catch (error) {
      console.error("Error fetching wallets:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  
  // Get wallet by ID
  exports.getWalletById = async (req, res) => {
    try {
      const { walletId } = req.params;
      const userId = req.user?.id; // Ensure authenticated user
  
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized: User ID not found" });
      }
  
      // Fetch wallet by ID and verify ownership
      const wallet = await Wallet.findOne({ _id: walletId, userId }).populate("transactions");
  
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found or access denied" });
      }
  
      // Format response
      const formattedWallet = {
        walletId: wallet._id,
        currency: wallet.currency,
        accountBalance: wallet.accountBalance,
        transactions: wallet.transactions,
      };
  
      res.status(200).json({ wallet: formattedWallet });
    } catch (error) {
      console.error("Error fetching wallet details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  