const express = require("express");
const router = express.Router();
const {authMiddleware} = require('../middlewares/authMiddleware');
const {
    createInvoice,
    getInvoices,
    updateInvoiceStatus,
    generateInvoicePDF,
    createTransaction,
    getTransactions
} = require("../controllers/invoiceTransactionController");




//invoice Routes
router.post('/invoice', authMiddleware, createInvoice);
router.get('/invoice', authMiddleware, getInvoices);
router.get('/invoice/:id/pdf', authMiddleware, generateInvoicePDF);
router.put('/invoice/:id/status', authMiddleware, updateInvoiceStatus);

//transaction Routes
router.post('/transaction', authMiddleware, createTransaction);
router.get('/transaction', authMiddleware, getTransactions);

module.exports = router;