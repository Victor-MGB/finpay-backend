const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { User, Wallet, SecurityLog } = require("../models/Users");
const { body, validationResult } = require("express-validator");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const rateLimit = require("express-rate-limit");
const validator = require("validator");
const axios = require("axios");
const otpGenerator = require("otp-generator");
const twilio = require("twilio");
const qrcode = require("qrcode");
const nodemailer = require("nodemailer");

// Set the JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "secret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "secret";

//function to get geo-location with country code
const getGeoLocation = async (ip) => {
  try {
    const response = await axios.get(`https://ipinfo.io/${ip}/json`);
    return {
      location: `${response.data.city}, ${response.data.country}`,
      countryCode: response.data.country,
    };
  } catch (error) {
    return { location: "Unknown Location", countryCode: "unknown" };
  }
};

// Twilio configuration
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const client = new twilio(accountSid, authToken);

// Register a new User
exports.registerUser = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Validate all the required fields
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    //validate phone number using libphonenumber-js
    const phoneNumber = parsePhoneNumberFromString(phone);
    if (!phoneNumber || !phoneNumber.isValid()) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    // Normalize phone number format (E.164 format: +234XXXXXXXXXX)
    const formattedPhone = phoneNumber.format("E.164");

    //get country code from phone number
    const countryCode = phoneNumber.country;

    // Normalize and validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    // Check for existing user (email or phone should be unique)
    const existingUser = await User.findOne({
      $or: [{ email }, { phone: formattedPhone }],
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Email or phone number already registered." });
    }

    // Hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const ip = req.headers["x-forwarded-for"] || req.ip;
    // Get user's geolocation from IP

    const geoData = await getGeoLocation(req.ip); // MOVED TO THE RIGHT PLACE

    //Generate numeric OTP (6-digits)
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      alphabets: false,
    });

    // Create new user object
    const newUser = new User({
      fullName,
      email,
      phone: formattedPhone,
      password: hashedPassword,
      countryCode, // From phone number
      ipCountryCode: geoData.countryCode, // From IP
      location: geoData.location, // From IP (city, country),
      otp, // Store OTP for verification
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // OTP expires in 10 mins
      isVerified: false, // User is not verified yet
  status: "active", // User is active by default
  disabled: false, // User is not disabled
    });

    // Save the user to the database
    await newUser.save();

    await client.messages.create({
      body: `Your verification code is: ${otp}`,
      from: twilioPhoneNumber,
      to: formattedPhone,
    });

    // Generate JWT token for email verification
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Log user registration in security logs
    // const geoData = await getGeoLocation(req.ip);
    const securityLog = await SecurityLog.create({
      userId: newUser._id,
      action: "User Registration",
      status: "success", // Change to lowercase if needed
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      location: geoData.location,
    });

    // Respond with success message
    return res.status(201).json({
      message: "Registration successful! Please verify your email.",
      token, // Send this token to the frontend for email verification
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        countryCode: newUser.countryCode, // Country from phone
        ipCountryCode: newUser.ipCountryCode, // Country from IP
        location: newUser.location, // City & Country from IP
        otp: newUser.otp, //Return otp testing
        isVerified: false, // User is not verified yet
  status: "active", // User is active by default
  disabled: false, // User is not disabled
      },
      securityLog, // Return security log details in response
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({ message: "Server error. Please try again" });
  }
};

exports.verifyOTPFromPhoneNumber = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "user not found" });
    }

    //check if user has exceded max otp attempts
    if (user.otpAttempts >= user.maxOtpAttempts) {
      user.disable = true;
      await user.save();
      return res
        .status(400)
        .json({
          message: "You have exceeded the maximum number of OTP attempts. Your account has been disabled.",
        });
    }

    //Check if OTP expired
    if (!user.otp || new Date() > user.otpExpiresAt) {
      return res
        .status(400)
        .json({ message: "OTP has expires. Request a new one" });
    }

    //validate OTP
    if (user.otp !== otp) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "Invalid OTP. Please try again" });
    }

    // Reset OTP details after successful verification
    user.otp = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.isVerified = true;
    await user.save();

    return res
      .status(200)
      .json({ message: "OTP verified successfully!", isVerified: true });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// Resend OTP to phone number
exports.resendOTP = async (req, res) => {
  try {
    const { userId } = req.body;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    //Generate new OTP and set expiry (10 minutes)
    const newOtp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      alphabets: false,
    });
    user.otp = newOtp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    user.otpAttempts = 0; // Reset attempts
    await user.save();

    //send OTP via SMS (Twilio or any service)
    await client.messages.create({
      body: `Your new OTP is: ${newOtp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.phone,
    });

    return res
      .status(200)
      .json({ message: "New OTP sent successfully!", otp: newOtp });
  } catch (error) {
    console.error("OTP Resend Error:", error);
    return res.status(500).json({ message: "Server error. Please try again." });
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
  const userAgent = req.headers["user-agent"] //get user's device info

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

     // 🚨 Prevent login if account is still in the 24-hour wait period
     if (user.reactivationWaitUntil && user.reactivationWaitUntil > new Date()) {
      return res.status(403).json({ message: "Account reactivated. Please wait 24 hours before logging in." });
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

    // Ensure user.sessions exists
if (!user.sessions) {
  user.sessions = [];
}

const isNewDevice = !user.sessions.some((s) => s.device === userAgent);
if (isNewDevice) {
  user.sessions.push({ device: userAgent, ip, loginTime: new Date() });

  // Send alert email
  await sendLoginAlert(user.email, ip, userAgent);
}


    // Assign account number & PIN if not set
    if (!user.accountNumber) user.accountNumber = generateAccountNumber();
    if (!user.accountPin) user.accountPin = generateSecurePin();

    // Ensure user has a wallet
    if (!user.finPayWallet) {
      const finPayWallet = new Wallet({
        userId: user._id,
        currency: "USD",
        balance: 0,
      });
      await finPayWallet.save();
      user.finPayWallet = finPayWallet._id;
    }


    // Generate JWT (Short-lived access token)
    const accessToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "15m" });

    // Generate Refresh Token (Longer Expiry)
    const refreshToken = jwt.sign({ userId: user._id }, REFRESH_SECRET, { expiresIn: "7d" });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    user.refreshToken = hashedRefreshToken;
    await user.save();

    res.json({
      message: "Login Successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        accountNumber: user.accountNumber,
        accountPin: user.accountPin,
        finPayWallet: user.finPayWallet,
        refreshToken: user.refreshToken
      },
    });
  } catch (error) {
    console.error("🔥 Login Error:", error);
    return res.status(500).json({ message: "Server error. Please try again" });
  }
};

async function sendLoginAlert(email, ip, device){
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"FinFlow" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "New Device Login Alert",
    text: `Your account was just logged into from a new device. If this was you, you can ignore this email. If not, please secure your account.`,
    html: `
      <h1>New Device Login Alert</h1>
      <p>Your account was just logged into from a new device.</p>
      <p><strong>Device:</strong> ${device}</p>
      <p><strong>IP Address:</strong> ${ip}</p>
      <p>If this was you, you can ignore this email. If not, please secure your account.</p>
    `,
  };

  await transport.sendMail(mailOptions);
}

// PATCH /users/biometric
exports.enableBiometric = async (req, res) => {
  try {
    const userId = req.user.id;
    const { enable } = req.body;

    // Validate the input
    if (typeof enable !== 'boolean') {
      return res.status(400).json({ message: "Invalid input for 'enable'" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update biometricAuth based on 'enable'
    user.biometricAuth = enable;

    // Save the user document with the updated biometricAuth status
    await user.save();

    // Log the biometric login action in SecurityLog for audit purposes
    const logDetails = enable ? "Biometric login enabled" : "Biometric login disabled";

    await SecurityLog.create({
      userId: userId,
      action: logDetails,
      status: "success", // Assuming this is a successful action
      ipAddress: req.ip, // Get the user's IP address
      userAgent: req.headers['user-agent'], // Get the user's browser info
      location: user.location || "Unknown", // Optional: Use a geolocation lookup if available
      timestamp: new Date(),
      details: logDetails, // Additional information
    });

    return res.status(200).json({
      message: enable ? "Biometric login enabled" : "Biometric login disabled",
    });
  } catch (error) {
    console.error("Biometric enable/disable error:", error);
    
    // Log failure in SecurityLog if an error occurs
    await SecurityLog.create({
      userId: req.user.id,
      action: "Biometric enable/disable attempt",
      status: "failure",
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      location: req.user.location || "Unknown",
      timestamp: new Date(),
      details: error.message, // Store the error message in details
    });

    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.updateAlerts = async (req, res) => {
  try {
    const { alerts } = req.body;
    const userId = req.user.id;

    const validTypes = ["low_balance", "transaction", "bill_due"];

    if (!Array.isArray(alerts) || alerts.length === 0) {
      return res.status(400).json({ message: "Alerts array is required" });
    }

    for (const alert of alerts) {
      const { type, threshold, active } = alert;

      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: `Invalid alert type: ${type}` });
      }

      if (typeof threshold !== "number" || typeof active !== "boolean") {
        return res.status(400).json({ message: `Invalid alert structure for type: ${type}` });
      }
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Process each alert
    for (const alert of alerts) {
      const existingIndex = user.alerts.findIndex(a => a.type === alert.type);

      if (existingIndex !== -1) {
        // Update existing alert
        user.alerts[existingIndex].threshold = alert.threshold;
        user.alerts[existingIndex].active = alert.active;
      } else {
        // Add new alert
        user.alerts.push({
          type: alert.type,
          threshold: alert.threshold,
          active: alert.active,
        });
      }
    }

    await user.save();

    return res.status(200).json({ message: "Alerts updated" });
  } catch (error) {
    console.error("Error updating alerts:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};