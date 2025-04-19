const express = require("express");
const router = express.Router();
const {createTaxPayment, uploadTaxDocument, getTaxPayments, getTaxDocuments} = require("../controllers/taxController")
const upload = require("../middlewares/uploads");
const {authMiddleware} = require("../middlewares/authMiddleware");

router.post("/tax-payments", createTaxPayment, authMiddleware);

router.post('/tax-documents', authMiddleware, upload.single("file"), uploadTaxDocument);

router.get('/tax-payments', authMiddleware, getTaxPayments);

router.get('/tax-documents', authMiddleware, getTaxDocuments);


module.exports = router;