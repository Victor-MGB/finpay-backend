require("dotenv").config();
const axios = require("axios");
const {Currency} = require("../models/Users");

const API_URL = process.env.EXCHANGE_RATE; // Example API

async function updateExchangeRates() {
  try {
    const response = await axios.get(API_URL);
    const rates = response.data.rates;

    for (const [currencyCode, exchangeRate] of Object.entries(rates)) {
      await Currency.findOneAndUpdate(
        { code: currencyCode },
        { exchangeRateToUSD: exchangeRate, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    }
    console.log("✅ Exchange rates updated successfully.");
  } catch (error) {
    console.error("❌ Error updating exchange rates:", error);
  }
}

// Run the function once a day
const exchangeRateInterval = setInterval(updateExchangeRates, 24 * 60 * 60 * 1000);
module.exports = { updateExchangeRates, exchangeRateInterval };

