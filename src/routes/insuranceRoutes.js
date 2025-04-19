
const express = require("express");
const router = express.Router();
const { purchaseInsurancePolicy, getInsurancePolicies, fileInsuranceClaim } = require("../controllers/insuranceController"); 
const { authMiddleware } = require("../middlewares/authMiddleware"); // Auth middleware to verify Bearer token

router.post("/insurance", authMiddleware, purchaseInsurancePolicy); // Purchase insurance policy

router.get("/insurance", authMiddleware, getInsurancePolicies); // List insurance policies

router.post("/insurance-policies/:id/claims", authMiddleware, fileInsuranceClaim);

module.exports = router;
