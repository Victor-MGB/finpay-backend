const express = require('express');
const {createWallet, getWallets, getWalletById, fundWallet} = require('../controllers/walletController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const router = express.Router()

router.post('/create', authMiddleware, createWallet);

// Get all wallets
router.get('/all', authMiddleware, getWallets);

//get wallet by id
router.get('/:walletId', authMiddleware, getWalletById);

//funding users wallets
router.post('/fund', authMiddleware, fundWallet);

module.exports = router;