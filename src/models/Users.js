const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// 🟢 User Schema (With Security Features)
const UserSchema = new Schema({
  fullName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // Hashed with bcrypt
  phone: { type: String, unique: true, required: true },
  accountNumber: { type: String, unique: true, default: null}, //finPay account number for in-app transaction Unique bank account number
  countryCode: { type: String }, // From phone number (e.g., NG, US)
  ipCountryCode: { type: String }, // From IP lookup
  location: { type: String }, // From IP lookup (e.g., "Lagos, Nigeria")
  // OTP Fields
  otp: { type: String },  // Stores the OTP as a string
  otpExpiresAt: { type: Date }, // Expiration time of OTP
  otpAttempts: { type: Number, default: 0 },  // Track failed attempts
  maxOtpAttempts: { type: Number, default: 5 }, // Limit attempts
  refreshToken: { type: String }, // Store hashed refresh token
  isVerified: { type: Boolean, default: false }, // Marks if the user has verified OTP
  accountPin: { type: String, default: null}, // Hashed PIN for transactions
  role: {
    type: String,
    enum: ["user", "admin", "support", "compliance", "superadmin"],
    default: "user",
  }, // Expanded roles
  dateOfBirth: { type: Date, default: null }, // For age verification
  age: { type: Number }, // Age will be auto-updated
  birthdayNotified: { type: Number, default: 0 }, // Stores the year of the last birthday notification
  kycVerified: { type: Boolean, default: false }, // KYC Verification Status
  kycDocuments: [
  {
    documentType: { type: String, required: true }, // Example: ID Card, Utility Bill
    url: { type: String, required: true }, // Cloudinary or S3 URL
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    uploadedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date }, // Timestamp of review (optional)
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin/Compliance who reviewed
    reason: { type: String }, // Store rejection reason
  },
], // KYC Documents
  wallets: [{ type: Schema.Types.ObjectId, ref: "Wallet" }], // Multiple currency wallets
  finPayWallet: { type: Schema.Types.ObjectId, ref: "Wallet" }, // Special wallet for FinPay transactions
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // New field
  status: {
    type: String,
    enum: ["active", "inactive", "suspended"], // New field for account status
    default: "active",
  },
  disabled: { type: Boolean, default: false }, // New field for account suspension
  suspensionEndDate: { type: Date, default: null }, // Auto-reactivation date
  reactivationWaitUntil: { type: Date, default: null }, // 24-hour wait time after reactivation
});

// 🟢 Wallet Schema (Multi-Currency Support)
const WalletSchema = new Schema({
  wallet_id: { type: Schema.Types.ObjectId, auto: true }, // Unique wallet identifier
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  currency: { type: String, required: true }, // Example: USD, EUR, GBP
  balance: { type: Schema.Types.Decimal128, default: 0.00 }, // Decimal balance
  transactions: [{ type: Schema.Types.ObjectId, ref: "Transaction" }], // Linked transactions
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // Last update timestamp
});

const PaymentMethodSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["card", "bank_account", "wallet"], required: true },
  cardLast4: { type: String, length: 4, required: function () { return this.type === "card"; } }, 
  cardBrand: { type: String, required: function () { return this.type === "card"; } },
  bankAccountLast4: { type: String, length: 4, required: function () { return this.type === "bank_account"; } },
  bankRoutingNumber: { type: String, required: function () { return this.type === "bank_account"; } },
  token: { type: String }, // Tokenized payment info from Stripe, Paystack, etc.
  isDefault: { type: Boolean, default: false }, // Marks the primary payment method
  createdAt: { type: Date, default: Date.now },
});

const PayoutSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  paymentMethodId: { type: Schema.Types.ObjectId, ref: "PaymentMethod", required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["pending", "completed", "failed"], 
    default: "pending" 
  },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});


// 🟢 Transaction Schema (Payments, Withdrawals, Deposits)
const TransactionSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: "User", default: null }, // Null for external senders
  receiverId: { type: Schema.Types.ObjectId, ref: "User", default: null }, // Null for external receivers
  amount: { type: Number, required: true },
  currency: { 
    type: String, 
    required: true, 
    enum: ["USD", "EUR", "GBP", "NGN"] // Restrict to valid currency codes
  },
    status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  type: {
    type: String,
    enum: ["payment", "refund", "transfer"],
    required: true,
  },
  paymentMethodId: { type: Schema.Types.ObjectId, ref: "PaymentMethod", default: null }, // Links to Payment Methods
  reference: { type: String, unique: true, required: true }, // Unique transaction ID
  description: { type: String, default: "" }, // Optional note like "Dinner split"
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  metadata: { type: Object, default: {} }, // Extra details like refund reasons
});

const TransactionFeeSchema = new Schema({
  transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", required: true }, // FK to Transactions
  amount: { type: Number, required: true }, // Fee amount
  currency: { type: String, required: true }, // Fee currency (e.g., USD)
  type: { 
    type: String, 
    enum: ["processing", "currency_conversion"], 
    required: true 
  }, // Fee type
  createdAt: { type: Date, default: Date.now }, // Timestamp
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

const MerchantSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // FK to Users
  businessName: { type: String, required: true }, // Legal business name
  merchantCategoryCode: { type: String, required: true }, // Industry type (MCC)
  apiKey: { type: String, unique: true, required: true, default: () => crypto.randomBytes(32).toString("hex") }, // Auto-generated API key
  createdAt: { type: Date, default: Date.now }, // Timestamp
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

const CurrencySchema = new Schema({
  code: { type: String, unique: true, required: true }, // USD, NGN, EUR
  name: { type: String, required: true }, // US Dollar, Nigerian Naira
  exchangeRateToUSD: { type: Number, default: null }, // 1 for USD, 0.0012 for NGN
  updatedAt: { type: Date, default: Date.now },
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
status: {
  type: String,
  enum: ["success", "failure"], // Example enum values
  required: true
},
  ipAddress: { type: String, required: true },
  userAgent: { type: String }, // Browser info (User-Agent header)
  location: { type: String }, // Geolocation (City, Country)
  timestamp: { type: Date, default: Date.now },
  details: { type: String }, // Additional information (optional)
});


const AuditLogSchema = new mongoose.Schema({
  performed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Admin who performed the action
  action: { type: String, required: true }, // Description of the action (e.g., "User status update")
  entity_type: { type: String, enum: ["User", "Transaction", "Account"], required: true }, // Type of entity affected
  entity_id: { type: mongoose.Schema.Types.ObjectId, refPath: "entity_type", default: null }, // Affected entity ID (nullable)
  details: { type: String }, // Extra information about the action
  created_at: { type: Date, default: Date.now } // Timestamp of the action
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
  PaymentMethod: model("PaymentMethod", PaymentMethodSchema),
  TransactionFee: model("TransactionFee", TransactionFeeSchema),
  Merchant: model("Merchant", MerchantSchema),
  Payout: model("Payout", PayoutSchema),
  Currency: model("Currency", CurrencySchema),
  AuditLog: model("AuditLog", AuditLogSchema),
};
