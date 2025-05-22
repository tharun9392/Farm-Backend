const { User, Product, Inventory, Sale, Task } = require('../models');
const mongoose = require('mongoose');

/**
 * Get dashboard analytics
 * @route GET /api/reports/dashboard
 * @access Private (Admin/Staff)
 */
const getDashboardAnalytics = async (req, res, next) => {
  try {
    console.log('Dashboard analytics request from:', req.user.role);
    
    // Get total counts
    const totalFarmers = await User.countDocuments({ role: 'farmer' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProducts = await Product.countDocuments();
    
    // Get inventory metrics
    const inventoryMetrics = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
          lowStockItems: { 
            $sum: { 
              $cond: [
                { $eq: ['$isLowStock', true] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    // Get order metrics (adjust for staff vs admin view)
    const orderQuery = req.user.role === 'admin' ? {} : { assignedTo: req.user._id };
    
    // Calculate pending tasks (staff only sees their own tasks)
    const taskQuery = req.user.role === 'admin' 
      ? { status: { $in: ['pending', 'in-progress'] } }
      : { 
          status: { $in: ['pending', 'in-progress'] },
          assignedTo: req.user._id
        };
      
    const pendingTasks = await Task.countDocuments(taskQuery);
    
    // Get new user registrations in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Get recent sales metrics
    const salesMetrics = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          ...(req.user.role === 'staff' ? { assignedTo: req.user._id } : {})
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    // Get pending orders count
    const pendingOrders = await Sale.countDocuments({ 
      status: 'pending',
      ...(req.user.role === 'staff' ? { assignedTo: req.user._id } : {})
    });
    
    // Return analytics data
    res.status(200).json({
      success: true,
      data: {
        totalFarmers,
        totalCustomers,
        totalProducts,
        inventory: inventoryMetrics.length > 0 ? inventoryMetrics[0] : {
          totalItems: 0,
          totalStock: 0,
          totalValue: 0,
          lowStockItems: 0
        },
        pendingTasks,
        newUsers,
        sales: salesMetrics.length > 0 ? salesMetrics[0] : {
          totalSales: 0,
          totalRevenue: 0
        },
        pendingOrders,
        totalOrders: salesMetrics.length > 0 ? salesMetrics[0].totalSales : 0,
        lowStockItems: inventoryMetrics.length > 0 ? inventoryMetrics[0].lowStockItems : 0
      }
    });
  } catch (error) {
    console.error('Error in dashboard analytics:', error);
    next(error);
  }
};

/**
 * Get sales analytics
 * @route GET /api/reports/sales
 * @access Private (Admin)
 */
const getSalesAnalytics = async (req, res, next) => {
  try {
    const { period } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1); // Default to last month
    }
    
    // Sales by date
    const salesByDate = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Sales by product category
    const salesByCategory = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $group: {
          _id: '$productInfo.category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      }
    ]);
    
    // Top selling products
    const topSellingProducts = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$product',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $project: {
          _id: 1,
          count: 1,
          totalAmount: 1,
          totalQuantity: 1,
          name: '$productInfo.name',
          category: '$productInfo.category',
          variety: '$productInfo.variety'
        }
      }
    ]);
    
    // Top farmers by sales
    const topFarmers = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$farmer',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'farmerInfo'
        }
      },
      {
        $unwind: '$farmerInfo'
      },
      {
        $project: {
          _id: 1,
          count: 1,
          totalAmount: 1,
          totalQuantity: 1,
          name: '$farmerInfo.name',
          location: '$farmerInfo.farmDetails.location'
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        salesByDate,
        salesByCategory,
        topSellingProducts,
        topFarmers
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory analytics
 * @route GET /api/reports/inventory
 * @access Private (Admin)
 */
const getInventoryAnalytics = async (req, res, next) => {
  try {
    // Stock by rice variety
    const stockByVariety = await Inventory.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $group: {
          _id: '$productInfo.variety',
          totalStock: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
          averagePrice: { $avg: '$sellingPrice' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { totalStock: -1 }
      }
    ]);
    
    // Stock by status
    const stockByStatus = await Inventory.aggregate([
      {
        $group: {
          _id: '$status',
          totalStock: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Low stock items detailed
    const lowStockItems = await Inventory.find({ isLowStock: true })
      .populate('product', 'name variety grade price')
      .populate('farmer', 'name')
      .sort({ currentStock: 1 })
      .limit(10);
    
    // Stock by warehouse
    const stockByWarehouse = await Inventory.aggregate([
      {
        $group: {
          _id: '$warehouseLocation',
          totalStock: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { totalStock: -1 }
      }
    ]);
    
    // Stock age analysis (how long items have been in inventory)
    const currentDate = new Date();
    const stockAgeAnalysis = await Inventory.aggregate([
      {
        $project: {
          ageInDays: { 
            $divide: [
              { $subtract: [currentDate, '$createdAt'] },
              24 * 60 * 60 * 1000
            ]
          },
          currentStock: 1,
          sellingPrice: 1
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $lt: ['$ageInDays', 30] },
              'Less than 30 days',
              {
                $cond: [
                  { $lt: ['$ageInDays', 60] },
                  '30 to 60 days',
                  {
                    $cond: [
                      { $lt: ['$ageInDays', 90] },
                      '60 to 90 days',
                      'Over 90 days'
                    ]
                  }
                ]
              }
            ]
          },
          totalStock: { $sum: '$currentStock' },
          totalValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        stockByVariety,
        stockByStatus,
        lowStockItems,
        stockByWarehouse,
        stockAgeAnalysis
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get farmer analytics
 * @route GET /api/reports/farmers
 * @access Private (Admin)
 */
const getFarmerAnalytics = async (req, res, next) => {
  try {
    // Farmers by status
    const farmersByStatus = await User.aggregate([
      {
        $match: { role: 'farmer' }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Farmers by location
    const farmersByLocation = await User.aggregate([
      {
        $match: { 
          role: 'farmer',
          'farmDetails.location': { $exists: true, $ne: '' }  
        }
      },
      {
        $group: {
          _id: '$farmDetails.location',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Farmers by registration date (monthly trend)
    const farmerRegistrationTrend = await User.aggregate([
      {
        $match: { role: 'farmer' }
      },
      {
        $group: {
          _id: { 
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      {
        $project: {
          _id: 0,
          date: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            ]
          },
          count: 1
        }
      }
    ]);
    
    // Active farmers with best performance (sales)
    const lastSixMonths = new Date();
    lastSixMonths.setMonth(lastSixMonths.getMonth() - 6);
    
    const topPerformingFarmers = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: lastSixMonths }
        }
      },
      {
        $group: {
          _id: '$farmer',
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgRiceQuantity: { $avg: '$quantity' }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'farmerInfo'
        }
      },
      {
        $unwind: '$farmerInfo'
      },
      {
        $project: {
          _id: 1,
          totalSales: 1,
          totalRevenue: 1,
          avgRiceQuantity: 1,
          name: '$farmerInfo.name',
          email: '$farmerInfo.email',
          location: '$farmerInfo.farmDetails.location',
          status: '$farmerInfo.status'
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        farmersByStatus,
        farmersByLocation,
        farmerRegistrationTrend,
        topPerformingFarmers
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardAnalytics,
  getSalesAnalytics,
  getInventoryAnalytics,
  getFarmerAnalytics
}; 