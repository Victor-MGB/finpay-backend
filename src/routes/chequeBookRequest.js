const express = require('express');
const router = express.Router();
const { requestChequeBook, getChequeBookRequests, updateChequeBookRequestStatus } = require('../controllers/chequeBookRequestController');
const { authMiddleware } = require('../middlewares/authMiddleware');  // Assuming authenticate is your middleware for checking JWT authentication

// POST endpoint to request a cheque book
router.post('/cheque-book-requests', authMiddleware, requestChequeBook);

// GET endpoint to track all cheque book requests for a user
router.get('/cheque-book-requests', authMiddleware, getChequeBookRequests);

router.patch("/admin/cheque-book-requests/:id", authMiddleware, updateChequeBookRequestStatus)

module.exports = router;
