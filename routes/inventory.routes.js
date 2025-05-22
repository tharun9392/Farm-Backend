const express = require('express');
const router = express.Router();
const { protect, isAdmin, isStaffOrAdmin } = require('../middleware/auth.middleware');
const {
  getAllInventory,
  getInventoryById,
  purchaseFromFarmer,
  updateInventory,
  getLowStockItems,
  getInventoryMetrics,
  adjustInventoryStock,
  updateQualityAssessment,
  getInventoryForecast,
  runBulkForecasting
} = require('../controllers/inventory.controller');

// Base route: /api/inventory

// Get all inventory items (admin & staff only)
router.get('/', protect, isStaffOrAdmin, getAllInventory);

// Get inventory metrics
router.get('/metrics', protect, isStaffOrAdmin, getInventoryMetrics);

// Get low stock items
router.get('/low-stock', protect, isStaffOrAdmin, getLowStockItems);

// Purchase from farmer to inventory
router.post('/purchase', protect, isStaffOrAdmin, purchaseFromFarmer);

// Run bulk forecasting (admin only)
router.post('/run-forecasting', protect, isAdmin, runBulkForecasting);

// Get inventory item by ID
router.get('/:id', protect, isStaffOrAdmin, getInventoryById);

// Update inventory item
router.put('/:id', protect, isStaffOrAdmin, updateInventory);

// Adjust inventory stock
router.post('/:id/adjust', protect, isStaffOrAdmin, adjustInventoryStock);

// Update quality assessment
router.post('/:id/quality', protect, isStaffOrAdmin, updateQualityAssessment);

// Get inventory forecast
router.get('/:id/forecast', protect, isStaffOrAdmin, getInventoryForecast);

module.exports = router; 