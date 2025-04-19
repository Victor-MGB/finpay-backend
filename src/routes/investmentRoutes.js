// routes/investmentRoutes.js
const express = require('express');
const router = express.Router();
const { purchaseInvestment, listInvestments, sellInvestment } = require('../controllers/investmentController'); // Adjust path if needed
const {authMiddleware} = require('../middlewares/authMiddleware'); // Auth middleware to verify Bearer token

// @route   POST /investments
// @desc    Purchase an investment
// @access  Private (authenticated users only)
router.post('/investments', authMiddleware, purchaseInvestment);

// @route   GET /investments
// @desc    List and monitor user's investments
// @access  Private
router.get('/investments', authMiddleware, listInvestments);

// @route   POST /investments/sell
// @desc    Sell an investment
// @access  Private
router.post('/investments/sell', authMiddleware, sellInvestment);

module.exports = router;
