const {User, Merchant, AuditLog} = require("../models/Users");
const merchantRegistrationSchema = require("../validators/merchantValidation");

exports.registerMerchant = async (req, res) => {
  try {
    const userId = req.user.id;

    // Validate input
    const { error, value } = merchantRegistrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { businessName, merchantCategoryCode } = value;

    const user = await User.findById(userId);
    if (!user || !user.kycVerified) {
      return res.status(403).json({ success: false, error: "KYC verification required." });
    }

    const existingMerchant = await Merchant.findOne({ userId });
    if (existingMerchant) {
      return res.status(400).json({
        success: false,
        error: "User already registered as a merchant.",
        merchantId: existingMerchant._id,
        apiKey: existingMerchant.apiKey,
      });
    }

    const newMerchant = await Merchant.create({
      userId,
      businessName,
      merchantCategoryCode,
    });

    if (user.role !== "merchant") {
      user.role = "merchant";
      await user.save();
    }

    res.status(201).json({
      success: true,
      message: "Merchant registered successfully.",
      data: {
        merchantId: newMerchant._id,
        apiKey: newMerchant.apiKey,
        businessName: newMerchant.businessName,
        categoryCode: newMerchant.merchantCategoryCode,
        createdAt: newMerchant.createdAt,
      },
    });
  } catch (err) {
    console.error("Merchant Registration Error:", err);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
};


exports.getMyMerchantDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    const merchant = await Merchant.findOne({ userId }).populate("userId", "email role");

    if (!merchant) {
      return res.status(404).json({ success: false, error: "Merchant not found." });
    }

    res.status(200).json({
      success: true,
      message: "Merchant details retrieved successfully.",
      data: {
        merchantId: merchant._id,
        businessName: merchant.businessName,
        merchantCategoryCode: merchant.merchantCategoryCode,
        apiKey: merchant.apiKey,
        createdAt: merchant.createdAt,
        user: {
          id: merchant.userId._id,
          email: merchant.userId.email,
          role: merchant.userId.role,
        }
      }
    });
  } catch (err) {
    console.error("Fetch Merchant Error:", err);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
};


exports.rotateApiKey = async (req, res) => {
  try {
    const userId = req.user.id;

    const merchant = await Merchant.findOne({ userId });

    if (!merchant) {
      return res.status(404).json({ success: false, error: "Merchant not found." });
    }

    const newApiKey = crypto.randomBytes(32).toString("hex");
    merchant.apiKey = newApiKey;
    await merchant.save();

    // Log in Audit
    await AuditLog.create({
      performed_by: userId,
      action: "API Key Rotated",
      entity_type: "User",
      entity_id: userId,
      details: `Merchant (${merchant._id}) API key was rotated.`,
    });

    res.status(200).json({
      success: true,
      message: "API key rotated successfully.",
      data: { newApiKey },
    });
  } catch (err) {
    console.error("API Key Rotation Error:", err);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
};