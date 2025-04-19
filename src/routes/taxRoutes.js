const express = require("express");
const router = express.Router();
const {createTaxPayment} = require("../controllers/taxController")
const {authMiddleware} = require("../middlewares/authMiddleware");

router.post("/tax-payments", createTaxPayment, authMiddleware);

module.exports = router;