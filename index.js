require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./src/config/db");
const morgan = require("morgan");
const winston = require("winston");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
// const birthdayJob  = require("./src/cron/cronjobs"); // Import cron job for birthday notifications
// const { sendBirthdayNotifications } = require("./src/cron/cronjobs"); // Import function to send birthday notifications
// require("./src/cron/cronJobs"); // Import cron jobs

const app = express();

// 🟢 Logger Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// If in development, log to console
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FinPay API",
      version: "1.0.0",
      description: "API documentation for FinPay application",
    },
  },
  apis: ["./src/routes/*.js"], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// 🟢 Middleware: Basic Security
app.use(helmet()); // Set security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: false })); // Form data
app.use(xss()); // Sanitize user input
app.use(hpp()); // Prevent HTTP Parameter Pollution
app.use(mongoSanitize()); // Prevent NoSQL Injection

// 🟢 Middleware: Logging HTTP Requests
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// 🟢 Middleware: Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use(limiter);

// Connect to MongoDB
connectDB();

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to FinPay API" });
});


// Routes
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/users", require("./src/routes/userRoutes"));
// app.use("/api/kyc", require("./src/routes/kycRoutes"));
app.use("/api/invoice", require("./src/routes/invoiceRoutes"));
app.use("/api/admin", require("./src/routes/adminRoutes"));
app.use("/api/wallet", require("./src/routes/walletRoutes"));
app.use("/api/payments", require("./src/routes/paymentRoutes"));
app.use("/api/transactions", require("./src/routes/transactionRoutes"));
app.use("/api/transaction-fee", require("./src/routes/transactionFeeRoutes"));
app.use("/api/payouts", require("./src/routes/payoutRoutes"));
app.use("/api/merchant", require("./src/routes/merchantRoutes"));
app.use("/api/virtual", require("./src/routes/virtualCardRoutes"));
app.use("/api/currency", require("./src/routes/currencyRoutes"));
app.use("/api/notification", require("./src/routes/notificationRoutes"));
app.use("/api/security", require("./src/routes/securityRoutes"));
app.use("/api/bill", require("./src/routes/billPaymentRoutes"));
app.use("/api/recharge", require("./src/routes/rechargeRoutes"));
app.use("/api/cheque", require("./src/routes/chequeBookRequest"));
app.use("/api/locations", require("./src/routes/locationRoutes"));
app.use("/api/statements", require("./src/routes/statementRoutes"));
app.use("/api/loans", require("./src/routes/loanRoutes"));
app.use("api/credit", require("./src/routes/creditCardRoutes"));
app.use("api/investment", require("./src/routes/investmentRoutes"));
app.use("api/sip", require("./src/routes/sipRoutes"));
app.use("api/insurance", require("./src/routes/insuranceRoutes"));
app.use("api/tax", require("./src/routes/taxRoutes"));

// // 🟢 Cron Jobs
// if (process.env.NODE_ENV !== 'test') {
//   // birthdayJob.start(); // Start the birthday notification cron job
//   logger.info("✅ Birthday notification cron job started.");
// }
//stripe webhook
app.use("/api/stripe", require("./src/routes/stripeWebhook"));

// 🟢 Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// Start the server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});


module.exports = app;