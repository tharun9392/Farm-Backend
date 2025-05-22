const Product = require('../models/product.model');
const mongoose = require('mongoose');

/**
 * Get all products
 * @route GET /api/products
 * @access Public
 */
const getAllProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, category, minPrice, maxPrice, sortBy, showAll, status, isProcessedRice } = req.query;

    // Enhanced logging for debugging
    console.log('GET /products request from:', req.user ? `${req.user.role} (${req.user.name})` : 'Unauthenticated user');
    console.log('Query parameters:', req.query);

    // Build filter conditions
    const filter = {};
    
    // Only return approved products for public view unless explicitly requested by admin/staff
    if (status) {
      // If specific status is requested, use that
      if (status.includes(',')) {
        // Handle comma-separated list of statuses
        filter.status = { $in: status.split(',') };
        console.log('Filtering by multiple statuses:', filter.status);
      } else {
        filter.status = status;
        console.log('Filtering by status:', status);
      }
    } else if (!showAll || (req.user && req.user.role !== 'admin' && req.user.role !== 'staff')) {
      // Otherwise default to only approved products for public/non-admin users
      filter.status = 'approved';
      console.log('Defaulting to approved products for public view');
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
      console.log('Added search filter:', search);
    }
    
    if (category) {
      filter.category = category;
      console.log('Filtering by category:', category);
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
      console.log('Filtering by price range:', filter.price);
    }
    
    // Filter by processed/raw status if specified
    if (isProcessedRice !== undefined) {
      // Special handling for the isProcessedRice parameter
      // Convert string 'true'/'false' to boolean
      if (isProcessedRice === 'true') {
        filter.isProcessedRice = true;
        console.log('Filtering by isProcessedRice: true (from string)');
      } else if (isProcessedRice === 'false') {
        filter.isProcessedRice = false;
        console.log('Filtering by isProcessedRice: false (from string)');
      } else if (typeof isProcessedRice === 'boolean') {
        filter.isProcessedRice = isProcessedRice;
        console.log('Filtering by isProcessedRice:', isProcessedRice, '(boolean)');
      } else {
        console.log('Invalid isProcessedRice value:', isProcessedRice, 'type:', typeof isProcessedRice);
      }
    } else {
      // Important workflow change: For customers (non-admin/staff users), only show processed rice
      // This ensures paddy (raw rice) does not appear in the shop regardless of approval status
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'staff')) {
        filter.isProcessedRice = true;
        console.log('Automatically filtering to show only processed rice to customers');
      }
    }

    console.log('Applied filters:', JSON.stringify(filter));

    // Build sort options
    let sort = {};
    if (sortBy) {
      const [field, order] = sortBy.split(':');
      sort[field] = order === 'desc' ? -1 : 1;
      console.log('Sorting by:', sort);
    } else {
      sort = { createdAt: -1 };
      console.log('Default sort by createdAt descending');
    }
    
    // Execute query with pagination
    const products = await Product.find(filter)
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('farmer', 'name profileImage');
    
    // Get total count for pagination
    const total = await Product.countDocuments(filter);
    
    console.log(`Found ${products.length} products matching filters. Total records: ${total}`);
    // Log first few products for debugging
    if (products.length > 0) {
      console.log('First product:', {
        id: products[0]._id,
        name: products[0].name,
        status: products[0].status,
        isProcessedRice: products[0].isProcessedRice,
        farmer: products[0].farmer?._id || products[0].farmer
      });
    }
    
    res.json({
      products,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total
    });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    next(error);
  }
};

/**
 * Get product by ID
 * @route GET /api/products/:id
 * @access Public
 */
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('farmer', 'name profileImage');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ product });
  } catch (error) {
    next(error);
  }
};

/**
 * Get products by farmer ID
 * @route GET /api/products/farmer/:farmerId
 * @access Private - Farmer (own), Admin, Staff
 */
const getProductsByFarmer = async (req, res, next) => {
  try {
    const { farmerId } = req.params;
    
    // Check if the requesting user is the farmer or admin/staff
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user._id.toString() !== farmerId) {
      return res.status(403).json({ message: 'Unauthorized access to these products' });
    }
    
    const products = await Product.find({ farmer: farmerId })
      .sort({ createdAt: -1 });
    
    res.json({ products });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new product
 * @route POST /api/products
 * @access Private - Admin and Staff only
 */
const createProduct = async (req, res, next) => {
  try {
    console.log('Creating product with data:', req.body);
    
    // Create a clean product object with proper defaults for safety
    const cleanProductData = {
      name: req.body.name?.trim(),
      description: req.body.description?.trim(),
      category: req.body.category,
      riceType: req.body.riceType || req.body.category, // Use category if riceType not provided
      price: req.body.price !== undefined && req.body.price !== '' ? Number(req.body.price) : 0,
      farmerPrice: req.body.farmerPrice !== undefined && req.body.farmerPrice !== '' ? Number(req.body.farmerPrice) : req.body.price,
      availableQuantity: req.body.availableQuantity !== undefined && req.body.availableQuantity !== '' ? Number(req.body.availableQuantity) : 0,
      stockQuantity: req.body.stockQuantity !== undefined && req.body.stockQuantity !== '' ? 
                    Number(req.body.stockQuantity) : 
                    (req.body.availableQuantity !== undefined ? Number(req.body.availableQuantity) : 0),
      unit: req.body.unit || 'kg',
      organicCertified: !!req.body.organicCertified,
      images: Array.isArray(req.body.images) ? req.body.images : [],
      // If farmer is submitting paddy, set status to pending, otherwise approved by default for admin/staff
      status: req.body.status || (req.user && req.user.role === 'farmer' ? 'pending' : 'approved'),
      // Respect the isProcessedRice flag if provided, otherwise default based on user role
      isProcessedRice: req.body.isProcessedRice !== undefined ? 
                      !!req.body.isProcessedRice : 
                      // If farmer is submitting, it's likely raw paddy
                      !(req.user && req.user.role === 'farmer'),
      farmer: req.body.farmer || req.user._id // Use provided farmer ID or current user
    };
    
    // Add paddySource if provided
    if (req.body.paddySource) {
      cleanProductData.paddySource = req.body.paddySource;
    }
    
    // Add paddyToRiceConversion if provided
    if (req.body.paddyToRiceConversion) {
      cleanProductData.paddyToRiceConversion = {
        rate: req.body.paddyToRiceConversion.rate !== undefined ? 
              Number(req.body.paddyToRiceConversion.rate) : 0.7,
        processingCost: req.body.paddyToRiceConversion.processingCost !== undefined ? 
                      Number(req.body.paddyToRiceConversion.processingCost) : 0
      };
    }
    
    // Only add harvestedDate if it's a valid date
    if (req.body.harvestedDate && Date.parse(req.body.harvestedDate)) {
      cleanProductData.harvestedDate = new Date(req.body.harvestedDate);
    }
    
    // Handle qualityParameters null or empty object case
    if (!req.body.qualityParameters || Object.keys(req.body.qualityParameters).length === 0) {
      cleanProductData.qualityParameters = undefined;
    } else {
      // Convert string numbers to actual numbers in qualityParameters
      const qualityParams = {};
      const rawParams = req.body.qualityParameters;
      
      if (rawParams.moisture !== undefined && rawParams.moisture !== '' && !isNaN(Number(rawParams.moisture))) {
        qualityParams.moisture = Number(rawParams.moisture);
      }
      
      if (rawParams.brokenGrains !== undefined && rawParams.brokenGrains !== '' && !isNaN(Number(rawParams.brokenGrains))) {
        qualityParams.brokenGrains = Number(rawParams.brokenGrains);
      }
      
      if (rawParams.foreignMatter !== undefined && rawParams.foreignMatter !== '' && !isNaN(Number(rawParams.foreignMatter))) {
        qualityParams.foreignMatter = Number(rawParams.foreignMatter);
      }
      
      if (rawParams.grainLength !== undefined && rawParams.grainLength !== '' && !isNaN(Number(rawParams.grainLength))) {
        qualityParams.grainLength = Number(rawParams.grainLength);
      }
      
      // Add string properties only if they're valid
      if (rawParams.aroma && ['strong', 'medium', 'mild', 'none'].includes(rawParams.aroma)) {
        qualityParams.aroma = rawParams.aroma;
      }
      
      if (rawParams.color && rawParams.color.trim() !== '') {
        qualityParams.color = rawParams.color.trim();
      }
      
      // Only add the qualityParameters object if it has any properties
      if (Object.keys(qualityParams).length > 0) {
        cleanProductData.qualityParameters = qualityParams;
      }
    }
    
    console.log('Cleaned product data:', cleanProductData);
    
    // Create product 
    const newProduct = new Product({
      ...cleanProductData
    });
    
    // Add certifications array if it exists
    if (req.body.certifications && Array.isArray(req.body.certifications)) {
      newProduct.certifications = req.body.certifications;
    }
    
    // Validate the product manually
    const validationError = newProduct.validateSync();
    if (validationError) {
      console.error('Product validation error:', validationError);
      return res.status(400).json({
        message: 'Product validation failed',
        errors: validationError.errors
      });
    }
    
    await newProduct.save();
    
    console.log('Product created successfully:', newProduct._id);
    
    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Check for MongoDB validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ 
        message: messages.join(', ')
      });
    }
    
    // Check for MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: `Duplicate field value: ${JSON.stringify(error.keyValue)}`
      });
    }
    
    next(error);
  }
};

/**
 * Update a product
 * @route PUT /api/products/:id
 * @access Private - Farmer (own), Admin
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if product exists
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is admin or the farmer who created this product
    if (req.user.role !== 'admin' && product.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to update this product' });
    }
    
    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a product
 * @route DELETE /api/products/:id
 * @access Private - Admin only
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Delete product
    const product = await Product.findByIdAndDelete(id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product status
 * @route PUT /api/products/:id/status
 * @access Private - Admin only
 */
const updateProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be one of: pending, approved, rejected'
      });
    }
    
    // If rejecting, reason is required
    if (status === 'rejected' && !reason) {
      return res.status(400).json({ 
        message: 'Reason is required when rejecting a product'
      });
    }
    
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Update status and reason
    product.status = status;
    if (reason) {
      product.statusReason = reason;
    }
    
    await product.save();
    
    res.status(200).json({
      message: `Product status updated to ${status}`,
      product
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByFarmer,
  updateProductStatus
}; 