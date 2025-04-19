const express = require('express');
const router = express.Router();
const { createSIP, paySIPInstallment  } = require('../controllers/sipController');
const {authMiddleware} = require('../middlewares/authMiddleware'); // Adjust path if needed

router.post('/sips', authMiddleware, createSIP);

router.post('/sips/:id/pay', authMiddleware, paySIPInstallment);

module.exports = router;
