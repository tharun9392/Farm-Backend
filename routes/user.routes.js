const express = require('express');
const router = express.Router();
const { protect, isAdmin, isStaffOrAdmin } = require('../middleware/auth.middleware');
const {
  getAllUsers,
  getUserById,
  getAllFarmers,
  getAllStaff,
  updateUserStatus,
  createStaffAccount,
  updateUser,
  deleteUser,
  getUserMetrics
} = require('../controllers/user.controller');
const { getCurrentUser } = require('../controllers/auth.controller');

// Base route: /api/users

// Get user metrics
router.get('/metrics', protect, isAdmin, getUserMetrics);

// Get all farmers (for staff and admin)
router.get('/farmers', protect, isStaffOrAdmin, getAllFarmers);

// Get all customers (for staff and admin)
router.get('/customers', protect, isStaffOrAdmin, (req, res, next) => {
  console.log('Customer route accessed by:', {
    userId: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  });
  next();
}, getAllUsers);

// Get all staff members (admin only)
router.get('/staff', protect, isAdmin, getAllStaff);

// Create staff account (admin only)
router.put('/create-staff', protect, isAdmin, createStaffAccount);

// Customer dashboard - this needs to be BEFORE the :id routes to avoid conflict
router.get('/customers/dashboard', protect, (req, res) => {
  try {
    // Basic structure for dashboard data
    // This is just a placeholder until you implement real data fetching
    const dashboardData = {
      orderCount: 0,
      pendingOrders: 0,
      deliveredOrders: 0,
      wishlistCount: 0,
      reviewCount: 0,
      recentOrders: [],
      recentlyViewedProducts: []
    };

    // Return the dashboard data
    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Error fetching customer dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard data', 
      error: error.message 
    });
  }
});

// Get all users
router.get('/', protect, isAdmin, getAllUsers);

// Update user status (approve/block)
router.put('/:id/status', protect, isAdmin, updateUserStatus);

// Add this route BEFORE any :id routes!
router.get('/profile', protect, getCurrentUser);

// Now the dynamic :id routes
router.get('/:id', protect, getUserById);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, isAdmin, deleteUser);

module.exports = router; 