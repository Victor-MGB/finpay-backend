// controllers/currencyController.js

const {Currency, CurrencyConversion} = require('../models/Users'); // adjust path if needed

// GET /currencies
exports.getAllCurrencies = async (req, res) => {
  try {
    const currencies = await Currency.find({}, 'code name exchangeRateToUSD');

    return res.status(200).json({
      success: true,
      message: 'List of supported currencies',
      data: currencies,
    });
  } catch (error) {
    console.error('Error fetching currencies:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch currencies',
      error: error.message,
    });
  }
};

exports.convertCurrency = async (req, res) => {
    try {
      const { baseCurrency, targetCurrency, amount } = req.query;
  
      // Validate input
      if (!baseCurrency || !targetCurrency || !amount || isNaN(amount)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide valid baseCurrency, targetCurrency, and amount',
        });
      }
  
      const numericAmount = parseFloat(amount);
  
      // Try direct conversion first
      let conversion = await CurrencyConversion.findOne({
        baseCurrency: baseCurrency.toUpperCase(),
        targetCurrency: targetCurrency.toUpperCase(),
      });
  
      let convertedAmount;
  
      if (conversion) {
        convertedAmount = numericAmount * conversion.exchangeRate;
      } else {
        // Fallback: use exchangeRateToUSD from Currency
        const [base, target] = await Promise.all([
          Currency.findOne({ code: baseCurrency.toUpperCase() }),
          Currency.findOne({ code: targetCurrency.toUpperCase() }),
        ]);
  
        if (!base || !target || base.exchangeRateToUSD == null || target.exchangeRateToUSD == null) {
          return res.status(404).json({
            success: false,
            message: 'Conversion rate not available for one or both currencies',
          });
        }
  
        // Convert base -> USD -> target
        const amountInUSD = numericAmount * base.exchangeRateToUSD;
        convertedAmount = amountInUSD / target.exchangeRateToUSD;
      }
  
      return res.status(200).json({
        success: true,
        convertedAmount: parseFloat(convertedAmount.toFixed(2)), // rounded
      });
    } catch (error) {
      console.error('Currency conversion error:', error);
      return res.status(500).json({
        success: false,
        message: 'Currency conversion failed',
        error: error.message,
      });
    }
  };
  

  exports.addCurrency = async (req, res) => {
    try {
      const { code, name, exchangeRateToUSD } = req.body;
      const user = req.user;
  
      // Superadmin check
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Access denied. Superadmin only.' });
      }
  
      // Check uniqueness
      const existingCurrency = await Currency.findOne({ code: code.toUpperCase() });
      if (existingCurrency) {
        return res.status(400).json({ success: false, message: 'Currency code already exists.' });
      }
  
      // Save currency
      const newCurrency = await Currency.create({
        code: code.toUpperCase(),
        name,
        exchangeRateToUSD,
      });
  
      // Log the action in AuditLog
      await AuditLog.create({
        performed_by: user._id,
        action: 'Added a new currency',
        entity_type: 'Currency',
        entity_id: newCurrency._id,
        details: `Currency ${name} (${code.toUpperCase()}) added with rate ${exchangeRateToUSD} to USD.`,
      });
  
      return res.status(201).json({
        success: true,
        message: 'Currency added successfully',
        currencyId: newCurrency._id,
      });
    } catch (error) {
      console.error('Error in addCurrency:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Server error while adding currency',
        error: error.message,
      });
    }
  };


  exports.updateCurrencyRate = async (req, res) => {
    try {
      const user = req.user;
      const { code } = req.params;
      const { exchangeRateToUSD } = req.body;
  
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Access denied. Superadmin only.' });
      }
  
      const currency = await Currency.findOne({ code: code.toUpperCase() });
      if (!currency) {
        return res.status(404).json({ success: false, message: 'Currency not found.' });
      }
  
      // Update fields
      currency.exchangeRateToUSD = exchangeRateToUSD;
      currency.updatedAt = new Date();
      await currency.save();
  
      // Audit log
      await AuditLog.create({
        performed_by: user._id,
        action: 'Updated currency exchange rate',
        entity_type: 'Currency',
        entity_id: currency._id,
        details: `Exchange rate for ${code.toUpperCase()} updated to ${exchangeRateToUSD}`,
      });
  
      return res.status(200).json({ success: true, message: 'Currency updated' });
    } catch (error) {
      console.error('Error updating currency:', error.message);
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  };