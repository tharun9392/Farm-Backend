const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const mongoose = require('mongoose');
const { createNotificationUtil } = require('./notification.controller');
const { sendOrderConfirmation, sendOrderStatusUpdate } = require('../utils/emailService');

// Helper function to create order status notification
const createOrderStatusNotification = async (order, statusChangeNote = '') => {
  try {
    const user = await User.findById(order.user);
    if (!user) return;

    let title = '';
    let message = '';
    
    switch (order.status) {
      case 'Processing':
        title = 'Order Confirmed';
        message = `Your order #${order.orderNumber} has been confirmed and is being processed.`;
        break;
      case 'Packed':
        title = 'Order Packed';
        message = `Your order #${order.orderNumber} has been packed and is ready for shipping.`;
        break;
      case 'Shipped':
        title = 'Order Shipped';
        message = `Your order #${order.orderNumber} has been shipped. ${order.trackingNumber ? `Tracking number: ${order.trackingNumber}` : ''}`;
        break;
      case 'Out for Delivery':
        title = 'Out for Delivery';
        message = `Your order #${order.orderNumber} is out for delivery and will arrive soon.`;
        break;
      case 'Delivered':
        title = 'Order Delivered';
        message = `Your order #${order.orderNumber} has been delivered. Thank you for shopping with us!`;
        break;
      case 'Cancelled':
        title = 'Order Cancelled';
        message = `Your order #${order.orderNumber} has been cancelled. ${statusChangeNote || ''}`;
        break;
      case 'Returned':
        title = 'Order Returned';
        message = `Your order #${order.orderNumber} has been marked as returned.`;
        break;
      case 'Refunded':
        title = 'Order Refunded';
        message = `Your order #${order.orderNumber} has been refunded.`;
        break;
      default:
        title = 'Order Update';
        message = `Your order #${order.orderNumber} has been updated to ${order.status}.`;
    }
    
    // Create notification for the customer
    await createNotificationUtil({
      recipient: order.user,
      title,
      message,
      type: 'order',
      link: `/orders/${order._id}`,
      metadata: {
        orderId: order._id
      }
    });
    
    // Notify staff for specific statuses
    if (['Cancelled', 'Returned'].includes(order.status)) {
      // Find staff users
      const staffUsers = await User.find({ role: { $in: ['admin', 'staff'] } });
      
      for (const staffUser of staffUsers) {
        await createNotificationUtil({
          recipient: staffUser._id,
          title: `Order ${order.status}`,
          message: `Order #${order.orderNumber} has been ${order.status.toLowerCase()}. ${statusChangeNote || ''}`,
          type: 'order',
          link: `/admin/orders/${order._id}`,
          metadata: {
            orderId: order._id
          }
        });
      }
    }
  } catch (error) {
    console.error('Error creating order notification:', error);
  }
};

/**
 * @desc    Create a new order
 * @route   POST /api/orders
 * @access  Private
 */
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { 
    items, 
    shippingAddress, 
    paymentMethod, 
    itemsPrice, 
    taxPrice, 
    shippingPrice, 
    totalPrice,
    paymentResult
  } = req.body;

  // Validate request
  if (!items || items.length === 0) {
    return next(new ErrorResponse('No order items', 400));
  }

  // Verify items are in stock and get product details
  const orderItems = await Promise.all(
    items.map(async (item) => {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return next(new ErrorResponse(`Product not found: ${item.productId}`, 404));
      }
      
      if (product.stockQuantity < item.quantity) {
        return next(new ErrorResponse(`Product ${product.name} is out of stock`, 400));
      }
      
      const farmer = await User.findById(product.farmer);
      
      return {
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        image: product.images[0] || '',
        farmer: product.farmer,
        farmerName: farmer ? farmer.name : 'Unknown Farmer'
      };
    })
  );

  // Create the order
  const order = new Order({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    status: paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Processing'
  });

  // If payment was already made (online payment)
  if (paymentResult) {
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = paymentResult;
  }

  // Calculate estimated delivery date (5 days from now)
  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);
  order.estimatedDeliveryDate = estimatedDelivery;

  // Save the order
  const createdOrder = await order.save();

  // Send order confirmation email
  await sendOrderConfirmation(req.user, order);

  // Create in-app notification
  await createNotificationUtil({
    user: req.user._id,
    title: 'Order Placed Successfully',
    message: `Your order #${createdOrder.orderNumber} has been placed successfully. We'll notify you when it ships.`,
    type: 'order',
    actionLink: `/customer/orders/${createdOrder._id}`,
    priority: 'normal'
  });

  // Notify admin and staff about new order
  const staffUsers = await User.find({ role: { $in: ['admin', 'staff'] } });
  for (const staffUser of staffUsers) {
    await createNotificationUtil({
      recipient: staffUser._id,
      title: 'New Order',
      message: `A new order #${createdOrder.orderNumber} has been placed by ${req.user.name}.`,
      type: 'order',
      link: `/admin/orders/${createdOrder._id}`,
      metadata: {
        orderId: createdOrder._id
      }
    });
  }

  res.status(201).json(createdOrder);
});

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
exports.getOrderById = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('items.product');

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Check if the user is authorized to view this order
  if (
    order.user._id.toString() !== req.user._id.toString() && 
    !['admin', 'staff'].includes(req.user.role)
  ) {
    return next(new ErrorResponse('Not authorized to access this order', 403));
  }

  res.status(200).json(order);
});

/**
 * @desc    Update order to paid
 * @route   PUT /api/orders/:id/pay
 * @access  Private
 */
exports.updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Check authorization
  if (
    order.user.toString() !== req.user._id.toString() && 
    !['admin', 'staff'].includes(req.user.role)
  ) {
    return next(new ErrorResponse('Not authorized to update this order', 403));
  }

  order.isPaid = true;
  order.paidAt = Date.now();
  order.paymentResult = {
    id: req.body.id,
    status: req.body.status,
    updateTime: req.body.update_time,
    emailAddress: req.body.email_address,
  };

  // Update status to Processing if it was Pending
  if (order.status === 'Pending') {
    order.status = 'Processing';
    // Set modifiedBy for status history
    order.modifiedBy = req.user._id;
  }

  const updatedOrder = await order.save();

  // Send order status update email
  await sendOrderStatusUpdate(req.user, updatedOrder, order.status, updatedOrder.status);

  // Create in-app notification
  await createNotificationUtil({
    user: order.user,
    title: `Order Status Updated: ${updatedOrder.status}`,
    message: `Your order #${updatedOrder.orderNumber} status has been updated from ${order.status} to ${updatedOrder.status}.`,
    type: 'order',
    actionLink: `/customer/orders/${updatedOrder._id}`,
    priority: updatedOrder.status === 'Cancelled' ? 'high' : 'normal'
  });

  res.status(200).json(updatedOrder);
});

/**
 * @desc    Update order status
 * @route   PUT /api/orders/:id/status
 * @access  Private (Admin and Staff only)
 */
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, note } = req.body;
  
  if (!status) {
    return next(new ErrorResponse('Status is required', 400));
  }

  const order = await Order.findById(req.params.id);
  
  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Only admin and staff can update order status
  if (!['admin', 'staff'].includes(req.user.role)) {
    return next(new ErrorResponse('Not authorized to update order status', 403));
  }

  // Check if the status transition is valid (implement business logic here)
  const validTransitions = {
    'Pending': ['Processing', 'Cancelled'],
    'Processing': ['Packed', 'Cancelled'],
    'Packed': ['Shipped', 'Cancelled'],
    'Shipped': ['Out for Delivery', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Returned'],
    'Delivered': ['Returned'],
    'Returned': ['Refunded'],
    'Cancelled': ['Refunded'],
    'Refunded': []
  };

  if (!validTransitions[order.status].includes(status)) {
    return next(
      new ErrorResponse(
        `Invalid status transition from ${order.status} to ${status}`,
        400
      )
    );
  }

  // Additional check for delivery status
  if (status === 'Delivered') {
    // Check if tracking info exists for delivery
    if (!order.trackingNumber || !order.courierProvider) {
      return next(
        new ErrorResponse(
          'Tracking information is required before marking as delivered',
          400
        )
      );
    }
  }

  // Set the new status
  order.status = status;
  order.modifiedBy = req.user._id; // For status history
  
  // Add note if provided
  if (note) {
    order.notes = note;
    order.statusHistory[order.statusHistory.length - 1].note = note;
  }

  // Update related fields
  if (status === 'Delivered') {
    order.isDelivered = true;
    order.deliveredAt = Date.now();
  } else if (status === 'Cancelled' && !order.cancellationReason) {
    order.cancellationReason = note || 'Cancelled by administrator';
  } else if (status === 'Refunded') {
    order.isRefunded = true;
    order.refundedAt = Date.now();
  }

  const updatedOrder = await order.save();
  
  // Send order status update email
  await sendOrderStatusUpdate(req.user, updatedOrder, order.status, updatedOrder.status);

  // Create notification about status change
  await createOrderStatusNotification(updatedOrder, note);

  // Create in-app notification
  await createNotificationUtil({
    user: order.user,
    title: `Order Status Updated: ${updatedOrder.status}`,
    message: `Your order #${updatedOrder.orderNumber} status has been updated from ${order.status} to ${updatedOrder.status}.`,
    type: 'order',
    actionLink: `/customer/orders/${updatedOrder._id}`,
    priority: updatedOrder.status === 'Cancelled' ? 'high' : 'normal'
  });

  res.status(200).json(updatedOrder);
});

/**
 * @desc    Cancel order
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
exports.cancelOrder = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;

  const order = await Order.findById(req.params.id);
  
  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Authorization: Customer can only cancel their own orders
  // Admin and staff can cancel any order
  if (
    order.user.toString() !== req.user._id.toString() && 
    !['admin', 'staff'].includes(req.user.role)
  ) {
    return next(new ErrorResponse('Not authorized to cancel this order', 403));
  }

  // Business rules: Can only cancel if order is not delivered or already cancelled
  const nonCancellableStatuses = ['Delivered', 'Cancelled', 'Returned', 'Refunded'];
  
  if (nonCancellableStatuses.includes(order.status)) {
    return next(
      new ErrorResponse(
        `Cannot cancel order with status: ${order.status}`,
        400
      )
    );
  }

  // Set cancellation details
  order.status = 'Cancelled';
  order.cancellationReason = reason || 'Cancelled by customer';
  order.modifiedBy = req.user._id; // For status history

  const updatedOrder = await order.save();
  
  // Send order status update email
  await sendOrderStatusUpdate(req.user, updatedOrder, order.status, updatedOrder.status);

  // Create notification about order cancellation
  await createOrderStatusNotification(updatedOrder, reason);

  // Create in-app notification
  await createNotificationUtil({
    user: order.user,
    title: `Order Status Updated: ${updatedOrder.status}`,
    message: `Your order #${updatedOrder.orderNumber} status has been updated from ${order.status} to ${updatedOrder.status}.`,
    type: 'order',
    actionLink: `/customer/orders/${updatedOrder._id}`,
    priority: updatedOrder.status === 'Cancelled' ? 'high' : 'normal'
  });

  res.status(200).json(updatedOrder);
});

/**
 * @desc    Update order tracking information
 * @route   PUT /api/orders/:id/tracking
 * @access  Private (Admin and Staff only)
 */
exports.updateTracking = asyncHandler(async (req, res, next) => {
  const { trackingNumber, courierProvider } = req.body;
  
  if (!trackingNumber || !courierProvider) {
    return next(new ErrorResponse('Tracking number and courier provider are required', 400));
  }

  const order = await Order.findById(req.params.id);
  
  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Only admin and staff can update tracking info
  if (!['admin', 'staff'].includes(req.user.role)) {
    return next(new ErrorResponse('Not authorized to update tracking information', 403));
  }

  // Update tracking info
  order.trackingNumber = trackingNumber;
  order.courierProvider = courierProvider;
  
  // Automatically update status to Shipped if currently in Packed status
  if (order.status === 'Packed') {
    order.status = 'Shipped';
    order.modifiedBy = req.user._id; // For status history
  }

  const updatedOrder = await order.save();

  // Send order status update email
  await sendOrderStatusUpdate(req.user, updatedOrder, order.status, updatedOrder.status);

  // Create in-app notification
  await createNotificationUtil({
    user: order.user,
    title: `Order Status Updated: ${updatedOrder.status}`,
    message: `Your order #${updatedOrder.orderNumber} status has been updated from ${order.status} to ${updatedOrder.status}.`,
    type: 'order',
    actionLink: `/customer/orders/${updatedOrder._id}`,
    priority: updatedOrder.status === 'Cancelled' ? 'high' : 'normal'
  });

  res.status(200).json(updatedOrder);
});

/**
 * @desc    Get logged in user orders
 * @route   GET /api/orders/my-orders
 * @access  Private
 */
exports.getMyOrders = asyncHandler(async (req, res, next) => {
  console.log('Getting orders for user:', {
    userId: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  });
  
  // Verify user object is properly populated
  if (!req.user || !req.user._id) {
    console.error('User object is missing or incomplete:', req.user);
    return next(new ErrorResponse('Authentication error. User information is incomplete.', 401));
  }
  
  let query = {};
  
  // Determine which orders to fetch based on user role
  if (req.user.role === 'customer') {
    // Customers see orders they placed
    console.log('Customer role detected - fetching orders for user ID:', req.user._id);
    query = { user: req.user._id };
  } else if (req.user.role === 'farmer') {
    // Farmers see orders for their products
    console.log('Farmer role detected - fetching orders for farmer ID:', req.user._id);
    query = { farmer: req.user._id };
  } else if (['admin', 'staff'].includes(req.user.role)) {
    // Admin/staff get all orders or assigned orders
    console.log('Admin/Staff role detected:', req.user.role);
    query = req.user.role === 'admin' ? {} : { assignedTo: req.user._id };
  } else {
    console.log('Unknown role detected:', req.user.role, '- defaulting to user orders');
    query = { user: req.user._id }; // Default fallback
  }
  
  console.log('Final query:', query);
  
  try {
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('farmer', 'name email');
    
    console.log(`Found ${orders.length} orders for the user`);
    
    res.status(200).json({ orders: orders || [] });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return next(new ErrorResponse(`Error fetching orders: ${error.message}`, 500));
  }
});

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private (Admin and Staff only)
 */
exports.getOrders = asyncHandler(async (req, res, next) => {
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;

  // Filtering
  const queryObj = { ...req.query };
  
  // Fields to exclude from filtering
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(field => delete queryObj[field]);

  // Processing status filter
  if (queryObj.status) {
    queryObj.status = queryObj.status;
  }

  // Date range filter
  if (queryObj.startDate && queryObj.endDate) {
    queryObj.createdAt = {
      $gte: new Date(queryObj.startDate),
      $lte: new Date(queryObj.endDate)
    };
    delete queryObj.startDate;
    delete queryObj.endDate;
  }

  // Search by order number
  if (queryObj.search) {
    queryObj.orderNumber = { $regex: queryObj.search, $options: 'i' };
    delete queryObj.search;
  }

  // Build the query
  let query = Order.find(queryObj)
    .populate('user', 'name email')
    .skip(startIndex)
    .limit(limit);

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Execute query
  const orders = await query;
  
  // Get total documents count for pagination
  const totalOrders = await Order.countDocuments(queryObj);

  res.status(200).json({
    success: true,
    count: orders.length,
    totalPages: Math.ceil(totalOrders / limit),
    currentPage: page,
    totalOrders,
    data: orders
  });
});

/**
 * @desc    Get order statistics and analytics
 * @route   GET /api/orders/stats
 * @access  Private (Admin and Staff only)
 */
exports.getOrderStats = asyncHandler(async (req, res, next) => {
  // Only admin and staff can view order stats
  if (!['admin', 'staff'].includes(req.user.role)) {
    return next(new ErrorResponse('Not authorized to access order statistics', 403));
  }

  // Order count by status
  const ordersByStatus = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalPrice' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Orders by date (last 7 days)
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const ordersByDate = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: last7Days }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: '$totalPrice' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Top products sold
  const topProducts = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    {
      $sort: { totalQuantity: -1 }
    },
    {
      $limit: 5
    }
  ]);

  // Payment method distribution
  const paymentMethods = await Order.aggregate([
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalPrice' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      ordersByStatus,
      ordersByDate,
      topProducts,
      paymentMethods
    }
  });
});

/**
 * @desc    Get order counts by status
 * @route   GET /api/orders/counts
 * @access  Private (Admin and Staff only)
 */
exports.getOrderCounts = asyncHandler(async (req, res, next) => {
  // Only admin and staff can view order counts
  if (!['admin', 'staff'].includes(req.user.role)) {
    return next(new ErrorResponse('Not authorized to access order counts', 403));
  }

  const counts = await Order.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
        },
        processing: {
          $sum: { $cond: [{ $eq: ['$status', 'Processing'] }, 1, 0] }
        },
        packed: {
          $sum: { $cond: [{ $eq: ['$status', 'Packed'] }, 1, 0] }
        },
        shipped: {
          $sum: { $cond: [{ $eq: ['$status', 'Shipped'] }, 1, 0] }
        },
        outForDelivery: {
          $sum: { $cond: [{ $eq: ['$status', 'Out for Delivery'] }, 1, 0] }
        },
        delivered: {
          $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
        },
        returned: {
          $sum: { $cond: [{ $eq: ['$status', 'Returned'] }, 1, 0] }
        },
        refunded: {
          $sum: { $cond: [{ $eq: ['$status', 'Refunded'] }, 1, 0] }
        }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: counts[0] || {
      total: 0,
      pending: 0,
      processing: 0,
      packed: 0,
      shipped: 0,
      outForDelivery: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
      refunded: 0
    }
  });
}); 