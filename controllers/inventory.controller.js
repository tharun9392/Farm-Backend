const { Inventory, Product, User } = require('../models');
const mongoose = require('mongoose');

/**
 * Get all inventory items
 * @route GET /api/inventory
 * @access Private (Admin/Staff)
 */
const getAllInventory = async (req, res, next) => {
  try {
    const query = {};
    const { status, lowStock, farmer } = req.query;
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Filter by low stock
    if (lowStock === 'true') {
      query.isLowStock = true;
    }
    
    // Filter by farmer
    if (farmer) {
      query.farmer = farmer;
    }
    
    // Execute query with pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    const inventory = await Inventory.find(query)
      .populate('product', 'name variety grade price imageUrl')
      .populate('farmer', 'name email phone')
      .populate('qualityVerification.verifiedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Inventory.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: inventory.length,
      total,
      pages: Math.ceil(total / limit),
      data: inventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory item by ID
 * @route GET /api/inventory/:id
 * @access Private (Admin/Staff)
 */
const getInventoryById = async (req, res, next) => {
  try {
    const inventory = await Inventory.findById(req.params.id)
      .populate('product', 'name variety grade price imageUrl description')
      .populate('farmer', 'name email phone farmDetails')
      .populate('qualityVerification.verifiedBy', 'name');
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Purchase product from farmer to inventory
 * @route POST /api/inventory/purchase
 * @access Private (Admin/Staff)
 */
const purchaseFromFarmer = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      productId,
      farmerId,
      quantityPurchased,
      purchasePrice,
      sellingPrice,
      packaging,
      warehouseLocation,
      lowStockThreshold
    } = req.body;
    
    // Validate input
    if (!productId || !farmerId || !quantityPurchased || !purchasePrice || !sellingPrice) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    
    // Check if product exists
    const product = await Product.findById(productId).session(session);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check if farmer exists
    const farmer = await User.findById(farmerId).session(session);
    if (!farmer || farmer.role !== 'farmer') {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }
    
    // Calculate total purchase amount
    const totalPurchaseAmount = purchasePrice * quantityPurchased;
    
    // Create new inventory item
    const inventoryItem = new Inventory({
      product: productId,
      farmer: farmerId,
      purchaseDetails: {
        quantityPurchased,
        purchasePrice,
        totalPurchaseAmount
      },
      currentStock: quantityPurchased,
      sellingPrice,
      packaging: packaging || {
        sizes: [{ weight: 1, price: sellingPrice, available: true }],
        defaultSize: 1
      },
      warehouseLocation,
      lowStockThreshold: lowStockThreshold || 50,
      qualityVerification: {
        verifiedBy: req.user._id,
        verificationDate: Date.now(),
        qualityGrade: product.grade || 'B+'
      }
    });
    
    await inventoryItem.save({ session });
    
    // Create a sale record - This would be implemented in a separate controller
    // but we can reference it here as a future enhancement
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      success: true,
      data: inventoryItem
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Update inventory item
 * @route PUT /api/inventory/:id
 * @access Private (Admin/Staff)
 */
const updateInventory = async (req, res, next) => {
  try {
    const {
      currentStock,
      sellingPrice,
      packaging,
      warehouseLocation,
      lowStockThreshold,
      qualityVerification,
      status
    } = req.body;
    
    const inventory = await Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Update fields
    if (currentStock !== undefined) inventory.currentStock = currentStock;
    if (sellingPrice !== undefined) inventory.sellingPrice = sellingPrice;
    if (packaging) inventory.packaging = packaging;
    if (warehouseLocation) inventory.warehouseLocation = warehouseLocation;
    if (lowStockThreshold !== undefined) inventory.lowStockThreshold = lowStockThreshold;
    if (qualityVerification) {
      inventory.qualityVerification = {
        ...inventory.qualityVerification,
        ...qualityVerification,
        verifiedBy: req.user._id,
        verificationDate: Date.now()
      };
    }
    if (status) inventory.status = status;
    
    const updatedInventory = await inventory.save();
    
    res.status(200).json({
      success: true,
      data: updatedInventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get low stock items
 * @route GET /api/inventory/low-stock
 * @access Private (Admin/Staff)
 */
const getLowStockItems = async (req, res, next) => {
  try {
    const inventory = await Inventory.find({ isLowStock: true })
      .populate('product', 'name variety grade price imageUrl')
      .populate('farmer', 'name email')
      .sort({ currentStock: 1 });
    
    res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory metrics
 * @route GET /api/inventory/metrics
 * @access Private (Admin)
 */
const getInventoryMetrics = async (req, res, next) => {
  try {
    console.log('getInventoryMetrics called by user:', {
      userId: req.user._id,
      role: req.user.role,
      name: req.user.name,
      email: req.user.email
    });
    
    // Total inventory count
    const totalItems = await Inventory.countDocuments();
    
    // Low stock items count
    const lowStockItems = await Inventory.countDocuments({ isLowStock: true });
    
    // Out of stock items count
    const outOfStockItems = await Inventory.countDocuments({ currentStock: 0 });
    
    // Total inventory value
    const inventoryValue = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
          totalStock: { $sum: '$currentStock' },
          averagePrice: { $avg: '$sellingPrice' }
        }
      }
    ]);
    
    // Top products by stock
    const topProducts = await Inventory.find()
      .sort({ currentStock: -1 })
      .limit(5)
      .populate('product', 'name')
      .select('product currentStock sellingPrice');
    
    res.status(200).json({
      success: true,
      data: {
        totalItems,
        lowStockItems,
        outOfStockItems,
        inventoryValue: inventoryValue.length ? inventoryValue[0] : { totalValue: 0, totalStock: 0, averagePrice: 0 },
        topProducts
      }
    });
  } catch (error) {
    console.error('Error fetching inventory metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory metrics',
      error: error.message
    });
  }
};

/**
 * Adjust inventory stock quantity
 * @route POST /api/inventory/:id/adjust
 * @access Private (Admin/Staff)
 */
const adjustInventoryStock = async (req, res, next) => {
  try {
    const { quantity, reason, type } = req.body;
    
    if (!quantity || !reason || !type) {
      return res.status(400).json({
        success: false,
        message: 'Quantity, reason, and adjustment type are required'
      });
    }
    
    const inventory = await Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Calculate new stock value
    const newStock = inventory.currentStock + Number(quantity);
    
    // Prevent negative stock
    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Adjustment would result in negative stock'
      });
    }
    
    // Update the stock quantity
    inventory.currentStock = newStock;
    
    // Add a stock movement record
    inventory.stockMovement.push({
      date: new Date(),
      quantity: Number(quantity),
      type,
      notes: reason,
      performedBy: req.user._id,
      reference: {
        model: 'Adjustment',
        id: null
      }
    });
    
    const updatedInventory = await inventory.save();
    
    res.status(200).json({
      success: true,
      data: updatedInventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update quality assessment
 * @route POST /api/inventory/:id/quality
 * @access Private (Admin/Staff)
 */
const updateQualityAssessment = async (req, res, next) => {
  try {
    const {
      moistureContent,
      broken,
      foreignMatter,
      discoloration,
      aroma,
      overallGrade,
      notes
    } = req.body;
    
    const inventory = await Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Create new quality assessment entry
    const assessment = {
      assessmentDate: new Date(),
      assessedBy: req.user._id,
      moistureContent,
      broken,
      foreignMatter,
      discoloration,
      aroma,
      overallGrade,
      notes
    };
    
    // Add to quality assessment array
    inventory.qualityAssessment.push(assessment);
    
    // Update the main quality verification info if overall grade is provided
    if (overallGrade) {
      inventory.qualityVerification = {
        ...inventory.qualityVerification,
        verifiedBy: req.user._id,
        verificationDate: new Date(),
        qualityGrade: overallGrade,
        notes: notes || inventory.qualityVerification.notes
      };
    }
    
    const updatedInventory = await inventory.save();
    
    res.status(200).json({
      success: true,
      data: updatedInventory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get forecast data for inventory
 * @route GET /api/inventory/:id/forecast
 * @access Private (Admin/Staff)
 */
const getInventoryForecast = async (req, res, next) => {
  try {
    const inventory = await Inventory.findById(req.params.id)
      .populate('product', 'name variety')
      .populate('farmer', 'name');
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // If we don't have at least 3 months of sales data, return a warning
    if (inventory.salesHistory.length < 3) {
      return res.status(200).json({
        success: true,
        warning: 'Insufficient sales history for accurate forecasting',
        data: {
          inventory,
          forecast: {
            predictedDemand: 0,
            confidenceLevel: 0,
            recommendedReorderQuantity: inventory.lowStockThreshold
          }
        }
      });
    }
    
    // In a real system, we'd use more sophisticated forecasting algorithms
    // For this demo, we'll use a simple moving average
    const lastThreeMonths = inventory.salesHistory.slice(-3);
    const avgMonthlySales = lastThreeMonths.reduce((sum, month) => 
      sum + month.quantitySold, 0) / lastThreeMonths.length;
    
    // Calculate forecasted values
    const predictedDemand = Math.round(avgMonthlySales * 1.1); // Add 10% growth
    const confidenceLevel = 70; // Simplified confidence level
    const recommendedReorderQuantity = Math.max(
      predictedDemand * 2, // 2 months of stock
      inventory.lowStockThreshold
    );
    
    // The point at which to reorder (when stock hits this level)
    const reorderPoint = Math.ceil(predictedDemand * 0.5); // 15 days of stock
    
    // Update the forecast in the database
    inventory.forecast = {
      predictedDemand,
      confidenceLevel,
      recommendedReorderQuantity,
      reorderPoint,
      lastUpdated: new Date()
    };
    
    await inventory.save();
    
    res.status(200).json({
      success: true,
      data: {
        inventory,
        salesTrend: inventory.salesHistory,
        forecast: {
          predictedDemand,
          confidenceLevel,
          recommendedReorderQuantity,
          reorderPoint
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Run forecasting for all inventory items
 * @route POST /api/inventory/run-forecasting
 * @access Private (Admin only)
 */
const runBulkForecasting = async (req, res, next) => {
  try {
    const inventoryItems = await Inventory.find({});
    const results = {
      processed: 0,
      updated: 0,
      skipped: 0
    };
    
    for (const item of inventoryItems) {
      results.processed++;
      
      // Skip items with insufficient data
      if (item.salesHistory.length < 3) {
        results.skipped++;
        continue;
      }
      
      // Calculate forecast (similar to getInventoryForecast method)
      const lastThreeMonths = item.salesHistory.slice(-3);
      const avgMonthlySales = lastThreeMonths.reduce((sum, month) => 
        sum + month.quantitySold, 0) / lastThreeMonths.length;
      
      const predictedDemand = Math.round(avgMonthlySales * 1.1);
      const confidenceLevel = 70;
      const recommendedReorderQuantity = Math.max(
        predictedDemand * 2,
        item.lowStockThreshold
      );
      const reorderPoint = Math.ceil(predictedDemand * 0.5);
      
      // Update the forecast
      item.forecast = {
        predictedDemand,
        confidenceLevel,
        recommendedReorderQuantity,
        reorderPoint,
        lastUpdated: new Date()
      };
      
      await item.save();
      results.updated++;
    }
    
    res.status(200).json({
      success: true,
      message: `Forecasting completed: ${results.updated} items updated, ${results.skipped} skipped`,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
}; 