const express = require('express');
const {createWallet, getWallets} = require('../controllers/walletController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const router = express.Router()

router.post('/create', authMiddleware, createWallet);

// Get all wallets
router.get('/all', authMiddleware, getWallets);

module.exports = router;