const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  getAllSales,
  getSalesByFarmer,
  getSaleById,
  createSale,
  updateSaleStatus,
  getSalesMetrics
} = require('../controllers/sale.controller');

// Get all sales - admin and staff only
router.get('/', protect, authorize(['admin', 'staff']), getAllSales);

// Get sales metrics - admin and staff only
router.get('/metrics', protect, authorize(['admin', 'staff']), getSalesMetrics);

// Get sales for a specific farmer
router.get('/farmer/:farmerId', protect, getSalesByFarmer);

// Get specific sale by ID
router.get('/:id', protect, getSaleById);

// Create a new sale - farmers only
router.post('/', protect, authorize(['farmer']), createSale);

// Update sale status
router.put('/:id/status', protect, updateSaleStatus);

module.exports = router; 