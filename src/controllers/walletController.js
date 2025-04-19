const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { User, AuditLog, Currency, Wallet } = require("../models/Users");
const updateExchangeRates = require("../services/fetchExchangeRates");

const twilio = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Create a new wallet
exports.createWallet = async (req, res) => {
  try {
    const { currency, accountType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID not found" });
    }

    if (!currency || !accountType) {
      return res.status(400).json({ message: "Currency and account type are required" });
    }

    const validAccountTypes = ["savings", "checking", "credit"];
    if (!validAccountTypes.includes(accountType.toLowerCase())) {
      return res.status(400).json({ message: "Invalid account type" });
    }

    await updateExchangeRates(); // Optional: If you're maintaining real-time currency validation

    // Validate if currency is supported
    const currencyRecord = await Currency.findOne({ code: currency.toUpperCase() });
    if (!currencyRecord) {
      return res.status(400).json({ message: "Unsupported currency" });
    }

    // Prevent duplicate wallet
    const walletExists = await Wallet.findOne({ userId, currency: currency.toUpperCase(), accountType });
    if (walletExists) {
      return res.status(400).json({ message: "Wallet with this currency and account type already exists" });
    }

    // Determine if it's a FinPay wallet (example logic: USD = FinPay)
    const isFinPayWallet = currency.toUpperCase() === "USD";

    // Create the wallet
    const wallet = new Wallet({
      userId,
      currency: currency.toUpperCase(),
      accountType,
      balance: 0,
      isFinPayWallet,
    });
    await wallet.save();

    // Update user document with wallet
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (isFinPayWallet) {
      user.finPayWallet = wallet._id;
    } else {
      user.wallets.push(wallet._id);
    }
    await user.save();

    // Log in AuditLog
    await AuditLog.create({
      performed_by: userId,
      action: "Wallet Created",
      entity_type: "Wallet",
      entity_id: wallet._id,
      details: `Wallet created with currency: ${currency}, type: ${accountType}`,
    });

    return res.status(201).json({ walletId: wallet._id, isFinPayWallet });
  } catch (error) {
    console.error("Error creating wallet:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all wallets
exports.getWallets = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID not found" });
    }

    // Fetch all wallets owned by the user and populate transactions
    const wallets = await Wallet.find({ userId }).populate("transactions");

    if (!wallets || wallets.length === 0) {
      return res.status(404).json({ message: "No wallets found for this user" });
    }

    // Format wallet data with selected transaction fields
    const formattedWallets = wallets.map(wallet => ({
      walletId: wallet._id,
      accountType: wallet.accountType,
      currency: wallet.currency,
      balance: parseFloat(wallet.balance.toString()),
      transactions: wallet.transactions.map(tx => ({
        reference: tx.reference,
        amount: tx.amount,
        status: tx.status,
      })),
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
      const userId = req.user?.id;
  
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized: User ID not found" });
      }
  
      // Fetch the wallet by ID
      const wallet = await Wallet.findById(walletId).populate("transactions");
  
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
  
      // Check ownership
      if (wallet.userId.toString() !== userId) {
        return res.status(403).json({ message: "Forbidden: You do not own this wallet" });
      }
  
      // Format response
      const formattedWallet = {
        walletId: wallet._id,
        accountType: wallet.accountType,
        currency: wallet.currency,
        accountBalance: parseFloat(wallet.balance.toString()),
        transactions: wallet.transactions.map(tx => ({
          reference: tx.reference,
          amount: tx.amount,
          status: tx.status,
        })),
      };
  
      res.status(200).json({ wallet: formattedWallet });
    } catch (error) {
      console.error("Error fetching wallet details:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };  
  
  exports.fundWallet = async (req, res) => {
    try{
      const userId = req.user?.id;
      const {walletId, amount, paymentMethodId} = req.body;

      if(!userId) return res.status(401).json({message: "Unauthorized: User ID not found"});
      if(!walletId || !amount || !paymentMethodId){
        return res.status(400).json({message: "Wallet ID, amount and payment method ID are required"});
      }

      const wallet = await Wallet.findOne({_id: walletId, userId});
      if (!wallet) return res.status(403).json({ message: "Forbidden: Not your wallet" });
      
      const user = await User.findById(userId);
      if (!user || !user.email) {
        return res.status(400).json({ message: "User email is required for Stripe payments" });
      }

      const fundingAmount = parseFloat(amount);
      if (isNaN(fundingAmount) || fundingAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
      }

      const feeOercentage = 0.20;
      const processingFee = parseFloat((fundingAmount * feeOercentage).toFixed(2));
      const netAmount = parseFloat((fundingAmount - processingFee).toFixed(2));

      //convert amount to cents (stripe uses smallest currency unit)
      const amountInCents = Math.round(fundingAmount * 100);

      //charge using stripe
      const charge = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: wallet.currency.toLowerCase(),
        customer: user.stripeCustomerId, // Assuming you have a Stripe customer ID stored in the user model
        payment_method: paymentMethodId,
        confirm: true,
        receipt_email: user.email,
        description: `Funding wallet ${walletId} with ${fundingAmount} ${wallet.currency}`,
      });

      //credit wallet balance
      wallet.balance = parseFloat(wallet.balance.toString()) + netAmount;
      await wallet.save();

      //credit transaction
      const transaction = await Transaction.create({
        userId,
        walletId,
        amount: netAmount,
        reference: charge.id,
        grossAmount: fundingAmount,
        status: "completed",
        type: "credit",
        currency: wallet.currency,
        paymentMethod: paymentMethodId,
        description: `Funding wallet ${walletId} with ${fundingAmount} ${wallet.currency}`,
      });

      //record fee
      await TransactionFee.create({
        transactionId: transaction._id,
        amount: processingFee,
        type: "processing",
        currency: wallet.currency,
      })

      //log in audit
      await AuditLog.create({
        performed_by: userId,
        action: "Wallet Funded",
        entity_type: "Wallet",
        entity_id: wallet._id,
        details: `Charged ${fundingAmount}, net ${netAmount}, fee ${processingFee}, paymentMethod: ${paymentMethodId}`,
      });


          // Optional: send SMS confirmation to user
          if (!user.phone) {
            const messageBody = `Hi ${user.firstName || "User"}, your wallet has been funded with ${wallet.currency} ${netAmount}. Transaction ID: ${transaction._id}.`;

            await twilio.messages.create({
              body: messageBody,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: user.phone,
            })
          }

          res.status(200).json({
            message: "Wallet funded successfully",
            transactionId: transaction._id,
            netAmount,
            processingFee,
          });
    }catch (error){
      console.error("Error from string  funding wallet:", error);

      if(error.type == 'StripeCardErrror'){
        return res.status(400).json({message: error.message});
      }
      res.status(500).json({ message: "Internal server error" });
    }
  };