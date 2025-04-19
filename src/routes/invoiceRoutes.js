const express = require("express");
const router = express.Router();
const {authMiddleware} = require('../middlewares/authMiddleware');
const { createInvoice, payInvoice, getInvoices, getInvoiceById} = require("../controllers/invoiceController")

//invoice Routes
router.post('/invoice', authMiddleware, createInvoice);

//Pay an invoice
router.patch("/invoices/:id/pay", authMiddleware, payInvoice);

router.get("/invoices", authMiddleware, getInvoices)

router.get("/invoices/:id", authMiddleware, getInvoiceById)

module.exports = router;