const express = require('express');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentById,
  getMyPayments,
  getAllPayments,
  processRefund,
  generateInvoiceEndpoint,
  getPaymentAnalytics,
  createFarmerPayment
} = require('../controllers/payment.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes (none for payments)

// Protected routes for all authenticated users
router.use(protect);
router.post('/razorpay/create', createRazorpayOrder);
router.post('/razorpay/verify', verifyRazorpayPayment);
router.get('/my-payments', getMyPayments);
router.get('/:id', getPaymentById);

// Admin only routes
router.use(authorize('admin'));
router.get('/', getAllPayments);
router.post('/farmer', createFarmerPayment);
router.post('/:id/refund', processRefund);
router.post('/:id/invoice', generateInvoiceEndpoint);
router.get('/analytics', getPaymentAnalytics);

module.exports = router; 