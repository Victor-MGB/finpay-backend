// utils/generateCard.js
const bcrypt = require("bcryptjs");

function generateCardNumber() {
  const prefix = "4000"; // Common Visa/MasterCard test prefix
  return `${prefix} ${rand4()} ${rand4()} ${rand4()}`;
}

function generateExpiryDate() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${(now.getFullYear() + 4).toString().slice(-2)}`;
}

function rand4() {
  return Math.floor(1000 + Math.random() * 9000);
}

function generateCVV() {
  return String(Math.floor(100 + Math.random() * 900));
}

async function encryptCVV(cvv) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(cvv, salt);
}

module.exports = {
  generateCardNumber,
  generateExpiryDate,
  generateCVV,
  encryptCVV
};
