const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect, isAdmin, isStaffOrAdmin } = require('../middleware/auth.middleware');

// Routes for reporting and analytics
// All routes are protected and only accessible by admin and staff

// Dashboard analytics
router.get(
  '/dashboard', 
  protect, 
  isStaffOrAdmin, 
  reportController.getDashboardAnalytics
);

// Sales analytics
router.get(
  '/sales', 
  protect, 
  isStaffOrAdmin, 
  reportController.getSalesAnalytics
);

// Inventory analytics
router.get(
  '/inventory', 
  protect, 
  isStaffOrAdmin, 
  reportController.getInventoryAnalytics
);

// Farmer analytics
router.get(
  '/farmers', 
  protect, 
  isStaffOrAdmin, 
  reportController.getFarmerAnalytics
);

module.exports = router; 