const express = require("express");
const router = express.Router();
const {
  applyForLoan,
  approveLoanApplication,
  rejectLoanApplication,
  closeLoanEarly,
  getLoanStats,
  getLoanApplications,
  getUserLoans,
  payLoanInstallment
} = require("../controllers/loanController");
const { authMiddleware } = require("../middlewares/authMiddleware"); // Assuming JWT middleware

router.post("/loan-applications", authMiddleware, applyForLoan);

//loan approave
router.post(
  "/loan-applications/:id/approve",
  authMiddleware,
  approveLoanApplication
);

//close loan
router.post(
  "/loan-applications/:id/close",
  authMiddleware,
  approveLoanApplication
);

router.post("/loan-applications/:id/reject", authMiddleware, rejectLoanApplication);
router.post("/loans/:id/close", authMiddleware, closeLoanEarly);
router.get("/admin/loan-stats", authMiddleware, getLoanStats);

router.get(
    "/loan-applications",
    authMiddleware,
    getLoanApplications
  );
  
  router.get("/loans", authMiddleware, getUserLoans);

  router.post("/loans/:id/pay", authMiddleware, payLoanInstallment);


module.exports = router;
