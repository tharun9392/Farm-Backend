const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validateProductCreation, validateProductUpdate } = require('../validations/product.validation');

// Controllers will be implemented
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByFarmer,
  updateProductStatus
} = require('../controllers/product.controller');

// Get all products - public access
router.get('/', getAllProducts);

// Get products by farmer ID - admin, staff, or the farmer themselves
router.get('/farmer/:farmerId', authenticate, getProductsByFarmer);

// Get product by ID - public access
router.get('/:id', getProductById);

// Create product - admin and staff only
router.post('/', authenticate, authorize(['admin', 'staff']), validateProductCreation, (req, res, next) => {
  // Set defaults for admin/staff product creation
  // Make sure isProcessedRice is true for admin/staff products (processed rice)
  req.body.isProcessedRice = true;
  // Set status to approved by default for admin/staff uploads
  req.body.status = 'approved';
  // If no farmer was specified, use a default or the current user
  if (!req.body.farmer) {
    req.body.farmer = req.user._id;
  }
  
  // Continue to the createProduct controller
  createProduct(req, res, next);
});

// Submit paddy - farmers can submit paddy for admin approval
router.post('/farmer/paddy', authenticate, authorize(['farmer']), validateProductCreation, (req, res, next) => {
  // Force isProcessedRice to false and status to pending
  req.body.isProcessedRice = false;
  req.body.status = 'pending';
  req.body.farmer = req.user._id; // Set the farmer to the current user
  
  // Continue to the createProduct controller
  createProduct(req, res, next);
});

// TEST ENDPOINT - Create test paddy for debugging
router.post('/test/create-paddy', authenticate, async (req, res, next) => {
  try {
    // Only admin can create test products
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can create test products' });
    }
    
    // Find a farmer user ID
    const User = require('../models/user.model');
    const farmers = await User.find({ role: 'farmer' }).limit(1);
    let farmerId = null;
    
    if (farmers.length > 0) {
      farmerId = farmers[0]._id;
    } else {
      // Create a mongoose ObjectId if no farmers found
      const mongoose = require('mongoose');
      farmerId = new mongoose.Types.ObjectId();
    }
    
    // Create a test paddy product with timestamp to ensure uniqueness
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const testProduct = new Product({
      name: `Test Paddy ${timestamp}`,
      description: 'Test paddy product for debugging',
      category: 'basmati',
      riceType: 'Basmati',
      price: 100,
      farmerPrice: 80,
      availableQuantity: 500,
      stockQuantity: 500,
      unit: 'kg',
      organicCertified: true,
      images: [],
      status: 'pending',
      isProcessedRice: false, // Raw paddy, not processed rice
      farmer: farmerId
    });
    
    await testProduct.save();
    
    res.status(201).json({
      message: 'Test paddy product created successfully',
      product: testProduct
    });
  } catch (error) {
    next(error);
  }
});

// Update product - only admin and staff can update products
router.put('/:id', authenticate, authorize(['admin', 'staff']), validateProductUpdate, updateProduct);

// Delete product - admins only
router.delete('/:id', authenticate, authorize(['admin']), deleteProduct);

// Update product status - admin and staff only
router.put('/:id/status', authenticate, authorize(['admin', 'staff']), updateProductStatus);

// TEST ROUTE - Create test paddy product (DEVELOPMENT ONLY)
router.get('/test/create-paddy', async (req, res) => {
  try {
    // Check if we're in development mode
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: 'Test routes only available in development mode' });
    }
    
    // Find a farmer to use
    const User = require('../models/user.model');
    const farmers = await User.find({ role: 'farmer' }).limit(1);
    let farmerId;
    
    if (farmers.length > 0) {
      farmerId = farmers[0]._id;
    } else {
      // Create a dummy farmer if none exists
      const mongoose = require('mongoose');
      farmerId = new mongoose.Types.ObjectId();
    }
    
    // Create a test paddy product
    const product = new Product({
      name: 'Test Paddy Product',
      description: 'This is a test paddy product created for debugging',
      category: 'basmati',
      riceType: 'basmati',
      price: 100,
      farmerPrice: 80,
      availableQuantity: 200,
      stockQuantity: 200,
      unit: 'kg',
      organicCertified: true,
      images: [],
      status: 'pending',
      isProcessedRice: false, // This is raw paddy, not processed rice
      farmer: farmerId
    });
    
    await product.save();
    
    res.json({ 
      message: 'Test paddy product created successfully', 
      product 
    });
  } catch (error) {
    console.error('Error creating test paddy:', error);
    res.status(500).json({ message: 'Failed to create test paddy product', error: error.message });
  }
});

module.exports = router;