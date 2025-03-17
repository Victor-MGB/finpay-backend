const mongoose = require("mongoose");
const { Schema, model, models } = mongoose;

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

// Prevent model overwrite error
const SecurityLog =
  models.SecurityLog || model("SecurityLog", SecurityLogSchema);

module.exports = SecurityLog;
