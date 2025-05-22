const Sale = require('../models/sale.model');
const Product = require('../models/product.model');
const mongoose = require('mongoose');

/**
 * Get all sales
 * @route GET /api/sales
 * @access Private - Admin, Staff
 */
const getAllSales = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus, startDate, endDate, sort } = req.query;
    
    // Build filter conditions
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sort) {
      const [field, order] = sort.split(':');
      sortOptions = { [field]: order === 'desc' ? -1 : 1 };
    }
    
    // Execute query with pagination
    const sales = await Sale.find(filter)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('farmer', 'name email')
      .populate('product', 'name category price');
    
    // Get total count for pagination
    const total = await Sale.countDocuments(filter);
    
    res.json({
      sales,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sales by farmer ID
 * @route GET /api/sales/farmer/:farmerId
 * @access Private - Farmer (own), Admin, Staff
 */
const getSalesByFarmer = async (req, res, next) => {
  try {
    const { farmerId } = req.params;
    const { page = 1, limit = 10, status, paymentStatus, startDate, endDate, sort } = req.query;
    
    // Check if requesting user is the farmer or admin/staff
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && req.user._id.toString() !== farmerId) {
      return res.status(403).json({ message: 'Unauthorized access to these sales records' });
    }
    
    // Build filter conditions
    const filter = { farmer: farmerId };
    
    if (status) {
      filter.status = status;
    }
    
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    // Build sort options
    let sortOptions = { createdAt: -1 };
    if (sort) {
      const [field, order] = sort.split(':');
      sortOptions = { [field]: order === 'desc' ? -1 : 1 };
    }
    
    // Execute query with pagination
    const sales = await Sale.find(filter)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('product', 'name category price');
    
    // Get total count for pagination
    const total = await Sale.countDocuments(filter);
    
    // Compute aggregate metrics
    const metrics = await Sale.aggregate([
      { $match: { farmer: mongoose.Types.ObjectId.createFromHexString(farmerId), status: 'completed' } },
      { 
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          averageOrderValue: { $avg: '$totalAmount' }
        } 
      }
    ]);
    
    // Get revenue by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const revenueByMonth = await Sale.aggregate([
      { 
        $match: { 
          farmer: mongoose.Types.ObjectId.createFromHexString(farmerId), 
          status: 'completed',
          createdAt: { $gte: sixMonthsAgo }
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' }, 
            month: { $month: '$createdAt' } 
          },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    res.json({
      sales,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
      metrics: metrics.length > 0 ? metrics[0] : {
        totalRevenue: 0,
        totalSales: 0,
        totalQuantity: 0,
        averageOrderValue: 0
      },
      revenueByMonth: revenueByMonth.map(item => ({
        year: item._id.year,
        month: item._id.month,
        revenue: item.revenue,
        count: item.count
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sale by ID
 * @route GET /api/sales/:id
 * @access Private - Farmer (own), Admin, Staff
 */
const getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const sale = await Sale.findById(id)
      .populate('farmer', 'name email')
      .populate('product', 'name category price');
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale record not found' });
    }
    
    // Check if requesting user is the farmer or admin/staff
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && 
        req.user._id.toString() !== sale.farmer._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized access to this sale record' });
    }
    
    res.json({ sale });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new sale
 * @route POST /api/sales
 * @access Private - Farmer
 */
const createSale = async (req, res, next) => {
  try {
    const { productId, quantity, unit, buyerType, buyer, paymentMethod, notes } = req.body;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is the farmer who owns this product
    if (product.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only record sales for your own products' });
    }
    
    // Calculate total amount based on product price and quantity
    const unitPrice = product.price;
    const totalAmount = unitPrice * quantity;
    
    // Create a new sale record
    const sale = new Sale({
      farmer: req.user._id,
      product: productId,
      quantity,
      unit: unit || product.unit,
      unitPrice,
      totalAmount,
      buyer,
      buyerType,
      paymentMethod,
      notes,
      status: 'pending', // Default status
      paymentStatus: 'pending' // Default payment status
    });
    
    // If selling to central inventory, update product stock
    if (buyerType === 'central_inventory') {
      // Reduce available quantity in the product
      if (product.availableQuantity < quantity) {
        return res.status(400).json({ message: 'Insufficient quantity available' });
      }
      
      product.availableQuantity -= quantity;
      await product.save();
      
      // Mark sale as completed immediately for central inventory
      sale.status = 'completed';
    }
    
    await sale.save();
    
    res.status(201).json({
      message: 'Sale recorded successfully',
      sale
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update sale status
 * @route PUT /api/sales/:id/status
 * @access Private - Farmer (own), Admin, Staff
 */
const updateSaleStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;
    
    // Check if sale exists
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale record not found' });
    }
    
    // Check if requesting user is the farmer or admin/staff
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && 
        req.user._id.toString() !== sale.farmer.toString()) {
      return res.status(403).json({ message: 'Unauthorized to update this sale record' });
    }
    
    // Update status
    if (status) {
      sale.status = status;
    }
    
    // Update payment status
    if (paymentStatus) {
      sale.paymentStatus = paymentStatus;
    }
    
    await sale.save();
    
    res.json({
      message: 'Sale status updated successfully',
      sale
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sales metrics for farmers
 * @route GET /api/sales/metrics
 * @access Private - Admin, Staff
 */
const getSalesMetrics = async (req, res, next) => {
  try {
    // Only allow admin and staff to access all metrics
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ message: 'Unauthorized access to sales metrics' });
    }
    
    // Overall metrics
    const overallMetrics = await Sale.aggregate([
      { $match: { status: 'completed' } },
      { 
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          averageOrderValue: { $avg: '$totalAmount' }
        } 
      }
    ]);
    
    // Top selling products
    const topProducts = await Sale.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$product',
          totalQuantity: { $sum: '$quantity' },
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $project: {
          _id: 1,
          productName: { $arrayElemAt: ['$productDetails.name', 0] },
          productCategory: { $arrayElemAt: ['$productDetails.category', 0] },
          totalQuantity: 1,
          totalAmount: 1,
          count: 1
        }
      }
    ]);
    
    // Top farmers by revenue
    const topFarmers = await Sale.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$farmer',
          totalRevenue: { $sum: '$totalAmount' },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'farmerDetails'
        }
      },
      {
        $project: {
          _id: 1,
          farmerName: { $arrayElemAt: ['$farmerDetails.name', 0] },
          farmerEmail: { $arrayElemAt: ['$farmerDetails.email', 0] },
          totalRevenue: 1,
          salesCount: 1
        }
      }
    ]);
    
    // Sales growth over time (monthly)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const salesByMonth = await Sale.aggregate([
      { 
        $match: { 
          status: 'completed',
          createdAt: { $gte: sixMonthsAgo }
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' }, 
            month: { $month: '$createdAt' } 
          },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    res.json({
      overallMetrics: overallMetrics.length > 0 ? overallMetrics[0] : {
        totalRevenue: 0,
        totalSales: 0,
        totalQuantity: 0,
        averageOrderValue: 0
      },
      topProducts,
      topFarmers,
      salesByMonth: salesByMonth.map(item => ({
        year: item._id.year,
        month: item._id.month,
        revenue: item.revenue,
        count: item.count
      }))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSales,
  getSalesByFarmer,
  getSaleById,
  createSale,
  updateSaleStatus,
  getSalesMetrics
}; 