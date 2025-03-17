   const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { User, Wallet } = require("../models/Users");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const SecurityLog = require("../models/SecurityLogSchema");
const validator = require("validator");
const axios = require("axios");

// Set the JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "secret";

// Register a new User
exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Validate all the required fields
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Normalize and validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    // Check for existing user (email or phone should be unique)
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Email or phone number already registered." });
    }

    // Hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Function to get geo-location
    const getGeoLocation = async (ip) => {
      try {
        const response = await axios.get(`https://ipinfo.io/${ip}/json`);
        return `${response.data.city}, ${response.data.country}`;
      } catch (error) {
        return "Unknown Location";
      }
    };

    // Create new user object
    const newUser = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
    });

    // Save the user to the database
    await newUser.save();

    // Generate JWT token for email verification
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Log user registration in security logs
    const location = await getGeoLocation(req.ip);
    await SecurityLog.create({
      userId: newUser._id,
      action: "User Registration",
      status: "success", // Change to lowercase if needed
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      location,
    });

    // Respond with success message
    return res.status(201).json({
      message: "Registration successful! Please verify your email.",
      token, // Send this token to the frontend for email verification
      user: {
        id: newUser._id,
        fullName: newUser.fullName, // Consistent property name
        email: newUser.email,
        phone: newUser.phone,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({ message: "Server error. Please try again" });
  }
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts
  message: "Too many login attempts, please try again after 15 minutes",
});

//Helper function: Generate Account Number
const generateAccountNumber = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

//Helper Function: Generate Secure Pin
const generateSecurePin = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const failedLoginAttempts = {}; // Store failed login attempts per IP

// Login an existing User
exports.loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { phone, password } = req.body;
  const ip = req.ip; // Get user's IP address

  // Check if the user is locked out
  if (failedLoginAttempts[ip] && failedLoginAttempts[ip].attempts >= 5) {
    const timePassed = Date.now() - failedLoginAttempts[ip].lastAttempt;
    const lockoutTime = 15 * 60 * 1000; // 15 minutes

    if (timePassed < lockoutTime) {
      return res.status(429).json({
        message: "Too many failed login attempts. Try again later.",
      });
    } else {
      delete failedLoginAttempts[ip]; // Reset after timeout
    }
  }

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      failedLoginAttempts[ip] = failedLoginAttempts[ip] || { attempts: 0, lastAttempt: Date.now() };
      failedLoginAttempts[ip].attempts += 1;
      failedLoginAttempts[ip].lastAttempt = Date.now();

      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      failedLoginAttempts[ip] = failedLoginAttempts[ip] || { attempts: 0, lastAttempt: Date.now() };
      failedLoginAttempts[ip].attempts += 1;
      failedLoginAttempts[ip].lastAttempt = Date.now();

      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Reset failed login attempts after a successful login
    delete failedLoginAttempts[ip];

    // Assign account number & PIN if not set
    if (!user.accountNumber) user.accountNumber = generateAccountNumber();
    if (!user.accountPin) user.accountPin = generateSecurePin();

    // Ensure user has a wallet
    if (!user.finPayWallet) {
      const finPayWallet = new Wallet({ userId: user._id, currency: "USD", balance: 0 });
      await finPayWallet.save();
      user.finPayWallet = finPayWallet._id;
    }

    await user.save();

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login Successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        accountNumber: user.accountNumber,
        accountPin: user.accountPin,
        finPayWallet: user.finPayWallet,
      },
    });
  } catch (error) {
    console.error("🔥 Login Error:", error);
    return res.status(500).json({ message: "Server error. Please try again" });
  }
};
