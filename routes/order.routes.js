const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect, isAdmin, isStaffOrAdmin } = require('../middleware/auth.middleware');

// Add middleware to debug authentication issues
router.use((req, res, next) => {
  console.log('Order Route Debug:', {
    url: req.originalUrl,
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
    authHeader: req.headers.authorization ? `${req.headers.authorization.substring(0, 15)}...` : 'None'
  });
  next();
});

// Routes for all authenticated users
router.route('/')
  .post(protect, orderController.createOrder)  // Create an order
  .get(protect, isStaffOrAdmin, orderController.getOrders);  // Get all orders (admin/staff)

// Get orders for the logged-in user
router.route('/my-orders')
  .get(protect, orderController.getMyOrders);

// Get order statistics and analytics
router.route('/stats')
  .get(protect, isStaffOrAdmin, orderController.getOrderStats);

// Get order counts by status
router.route('/counts')
  .get(protect, isStaffOrAdmin, orderController.getOrderCounts);

// Routes for specific orders
router.route('/:id')
  .get(protect, orderController.getOrderById);  // Get single order

// Update order payment status
router.route('/:id/pay')
  .put(protect, orderController.updateOrderToPaid);

// Update order status (admin/staff)
router.route('/:id/status')
  .put(protect, isStaffOrAdmin, orderController.updateOrderStatus);

// Remove this route until controller is implemented
// router.route('/:id/delivery')
//   .put(protect, isStaffOrAdmin, orderController.updateDeliveryStatus);

// Cancel an order (customer or admin/staff)
router.route('/:id/cancel')
  .put(protect, orderController.cancelOrder);

// Update tracking information
router.route('/:id/tracking')
  .put(protect, isStaffOrAdmin, orderController.updateTracking);

module.exports = router; 