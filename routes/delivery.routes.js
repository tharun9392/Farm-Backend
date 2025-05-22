const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const deliveryController = require('../controllers/delivery.controller');

// Base route: /api/deliveries

// Routes for all deliveries (admin/staff only)
router
  .route('/')
  .post(protect, authorize(['admin', 'staff']), deliveryController.createDelivery)
  .get(protect, authorize(['admin', 'staff']), deliveryController.getAllDeliveries);

// Routes for specific delivery
router
  .route('/:id')
  .get(protect, deliveryController.getDeliveryById);

// Update delivery status
router
  .route('/:id/status')
  .put(protect, authorize(['admin', 'staff']), deliveryController.updateDeliveryStatus);

module.exports = router; 