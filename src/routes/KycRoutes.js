const express = require("express");
const router = express.Router();
const {uploadKycDocument, getAllKycDocuments, reviewedKycDocument} = require("../controllers/kycController");
const upload = require("../middlewares/uploads");
const authorizeRoles = require("../middlewares/roleMiddleware");
const {authMiddleware} = require("../middlewares/authMiddleware");

router.post(
  "/kyc/upload",
  authMiddleware,
    upload.single("file"),
  uploadKycDocument
);

// Compliance/Admin approves/rejects documents
router.post("/kyc/review", authorizeRoles, reviewedKycDocument);

// Compliance/Admin views all documents
router.get("/kyc/documents", authorizeRoles, getAllKycDocuments);
module.exports = router;
