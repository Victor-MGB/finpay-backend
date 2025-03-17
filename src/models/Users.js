const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// 🟢 User Schema (With Security Features)
const UserSchema = new Schema({
  fullName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // Hashed with bcrypt
  phone: { type: String, unique: true, required: true },
  accountNumber: { type: String, unique: true, required: true }, // Unique bank account number
  accountBalance: { type: Number, default: 0 }, // Initial balance is 0
  accountPin: { type: String, required: true }, // Hashed PIN for transactions
  role: { type: String, enum: ["user", "admin"], default: "user" }, // Role-Based Access
  kycVerified: { type: Boolean, default: false }, // KYC Verification Status
  kycDocuments: [{ documentType: String, url: String }], // ID, Utility Bill, etc.
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String }, // For 2FA OTP Authenticator
  wallets: [{ type: Schema.Types.ObjectId, ref: "Wallet" }], // Multiple currency wallets
  finPayWallet: { type: Schema.Types.ObjectId, ref: "Wallet" }, // Special wallet for FinPay transactions
  createdAt: { type: Date, default: Date.now },
});

// 🟢 Wallet Schema (Multi-Currency Support)
const WalletSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  currency: { type: String, required: true }, // Example: USD, EUR, GBP
  balance: { type: Number, default: 0 },
  transactions: [{ type: Schema.Types.ObjectId, ref: "Transaction" }], // Linked transactions
  createdAt: { type: Date, default: Date.now },
});

// 🟢 Transaction Schema (Payments, Withdrawals, Deposits)
const TransactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  transactionType: {
    type: String,
    enum: ["deposit", "withdrawal", "payment"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  reference: { type: String, unique: true, required: true }, // Unique transaction ID
  paymentGateway: {
    type: String,
    enum: ["Stripe", "Paystack", "Flutterwave", "Wise"],
  },
  createdAt: { type: Date, default: Date.now },
});

// 🟢 Invoice Schema (Billing & Payments)
const InvoiceSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  dueDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ["unpaid", "paid", "overdue"],
    default: "unpaid",
  },
  items: [{ description: String, quantity: Number, price: Number }],
  reference: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now },
});

// 🟢 Virtual Card Schema (For Secure Transactions)
const VirtualCardSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  cardNumber: { type: String, required: true },
  cardType: { type: String, enum: ["Visa", "MasterCard"], required: true },
  cvv: { type: String, required: true }, // Encrypted storage
  expiryDate: { type: String, required: true },
  status: { type: String, enum: ["active", "blocked"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});

// 🟢 Currency Conversion Schema
const CurrencyConversionSchema = new Schema({
  baseCurrency: { type: String, required: true },
  targetCurrency: { type: String, required: true },
  exchangeRate: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

// 🟢 Notification Schema (Alerts & Updates)
const NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// 🟢 Security Logs (For Cybersecurity & Auditing)
const SecurityLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true }, // Example: "Login Attempt", "Password Reset"
  status: { type: String, enum: ["success", "failed"], default: "success" },
  ipAddress: { type: String, required: true },
  userAgent: { type: String }, // Browser info
  timestamp: { type: Date, default: Date.now },
});

// Export models
module.exports = {
  User: model("UserBank", UserSchema),
  Wallet: model("Wallet", WalletSchema),
  Transaction: model("Transaction", TransactionSchema),
  Invoice: model("Invoice", InvoiceSchema),
  VirtualCard: model("VirtualCard", VirtualCardSchema),
  CurrencyConversion: model("CurrencyConversion", CurrencyConversionSchema),
  Notification: model("Notification", NotificationSchema),
  SecurityLog: model("SecurityLog", SecurityLogSchema),
};
