const { User } = require('../models');

/**
 * Get all users
 * @route GET /api/users
 * @route GET /api/users/customers (for staff)
 * @access Private (Admin only or staff for customers route)
 */
const getAllUsers = async (req, res, next) => {
  try {
    console.log('Path in getAllUsers:', req.path, 'Original URL:', req.originalUrl);
    
    const { role, status, search } = req.query;
    let query = {};
    
    // When accessed through the /customers endpoint, restrict to customers only
    if (req.originalUrl.includes('/users/customers')) {
      console.log('Customer endpoint detected, restricting to customer role');
      query.role = 'customer';
    }
    // Otherwise use the role filter if provided
    else if (role) {
      query.role = role;
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Execute query
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limit),
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 * @route GET /api/users/:id
 * @access Private (Admin or own user)
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Allow access if admin or the user themselves
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all farmers
 * @route GET /api/users/farmers
 * @access Private (Admin only)
 */
const getAllFarmers = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = { role: 'farmer' };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Execute query
    const farmers = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: farmers.length,
      total,
      pages: Math.ceil(total / limit),
      data: farmers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all staff members
 * @route GET /api/users/staff
 * @access Private (Admin only)
 */
const getAllStaff = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = { role: 'staff' };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Execute query
    const staff = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: staff.length,
      total,
      pages: Math.ceil(total / limit),
      data: staff
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user status (approve, block, etc.)
 * @route PUT /api/users/:id/status
 * @access Private (Admin only)
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Validate status
    const validStatuses = ['pending', 'active', 'blocked'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: pending, active, blocked'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update status
    user.status = status;
    
    // If approving a farmer, set their status to active
    if (user.role === 'farmer' && status === 'active') {
      user.isApproved = true;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create staff account
 * @route POST /api/users/staff
 * @access Private (Admin only)
 */
const createStaffAccount = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    
    // Check if user with email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create staff user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'staff',
      status: 'active',
      isApproved: true
    });
    
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user
 * @route PUT /api/users/:id
 * @access Private (Admin or own user)
 */
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Allow access if admin or the user themselves
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this user'
      });
    }
    
    // Admin can update any fields including role, status
    if (req.user.role === 'admin') {
      const { name, email, phone, address, role, status } = req.body;
      
      if (name) user.name = name;
      if (email) user.email = email;
      if (phone) user.phone = phone;
      if (address) user.address = address;
      if (role) user.role = role;
      if (status) user.status = status;
      
      // If role is farmer and includes farm details
      if (role === 'farmer' && req.body.farmDetails) {
        user.farmDetails = {
          ...user.farmDetails,
          ...req.body.farmDetails
        };
      }
    } else {
      // User can only update their own profile fields
      const { name, phone, address } = req.body;
      
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (address) user.address = address;
      
      // Farmers can update their farm details
      if (user.role === 'farmer' && req.body.farmDetails) {
        user.farmDetails = {
          ...user.farmDetails,
          ...req.body.farmDetails
        };
      }
    }
    
    const updatedUser = await user.save();
    
    res.status(200).json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
        role: updatedUser.role,
        status: updatedUser.status,
        farmDetails: updatedUser.farmDetails
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user
 * @route DELETE /api/users/:id
 * @access Private (Admin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    await user.remove();
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user metrics
 * @route GET /api/users/metrics
 * @access Private (Admin only)
 */
const getUserMetrics = async (req, res, next) => {
  try {
    // Total users count
    const totalUsers = await User.countDocuments();
    
    // Count by role
    const roleCounts = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Count by status
    const statusCounts = await User.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // New users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Format the metrics in a more user-friendly way
    const formattedRoleCounts = roleCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    
    const formattedStatusCounts = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        roleCounts: formattedRoleCounts,
        statusCounts: formattedStatusCounts,
        newUsers
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getAllFarmers,
  getAllStaff,
  updateUserStatus,
  createStaffAccount,
  updateUser,
  deleteUser,
  getUserMetrics
}; 