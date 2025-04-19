const express = require('express');
const router = express.Router();
const {applyForCreditCard, getCreditCardApplications, payCreditCardBalance, updateCreditCardApplication} = require('../controllers/creditCardController');
const {authMiddleware} = require('../middlewares/authMiddleware'); // your JWT middleware

router.post('/credit-card-applications', authMiddleware, applyForCreditCard);

router.get('/credit-card-applications', authMiddleware, getCreditCardApplications);

router.post('/virtual-cards/:id/pay', authMiddleware, payCreditCardBalance)

router.patch("/admin/credit-card-applications/:id", authMiddleware, updateCreditCardApplication)

module.exports = router;
