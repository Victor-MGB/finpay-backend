const express = require('express');
const router = express.Router();
const { getAllCurrencies, convertCurrency, addCurrency, updateCurrencyRate } = require('../controllers/currencyController');
const {authMiddleware} = require('../middlewares/authMiddleware'); // Adjust the path as necessary

router.get('/currencies', getAllCurrencies); // Public endpoint

router.get('/currency/convert', convertCurrency); // <== New endpoint

router.post('/currencies', authMiddleware, addCurrency); // Protect this route

router.patch('/currencies/:code', authMiddleware, updateCurrencyRate); // PATCH endpoint
module.exports = router;
