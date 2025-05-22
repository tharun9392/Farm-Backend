const Delivery = require('../models/delivery.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const mongoose = require('mongoose');

/**
 * @desc    Create a delivery schedule
 * @route   POST /api/deliveries
 * @access  Private (Admin/Staff only)
 */
exports.createDelivery = asyncHandler(async (req, res, next) => {
  const {
    orderId,
    scheduledDate,
    timeSlot,
    deliveryAgent,
    address,
    specialInstructions,
    priority,
    isContactless
  } = req.body;

  // Validate required fields
  if (!orderId || !scheduledDate) {
    return next(new ErrorResponse('Order ID and scheduled date are required', 400));
  }

  // Check if order exists
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Verify order is in a state that can be scheduled for delivery
  if (!['Packed', 'Shipped'].includes(order.status)) {
    return next(
      new ErrorResponse(
        `Orders in ${order.status} status cannot be scheduled for delivery`,
        400
      )
    );
  }

  // Check if a delivery already exists for this order
  const existingDelivery = await Delivery.findOne({ order: orderId });
  if (existingDelivery) {
    return next(
      new ErrorResponse(
        `A delivery is already scheduled for this order. Please update the existing delivery.`,
        400
      )
    );
  }

  // Create delivery
  const delivery = await Delivery.create({
    order: orderId,
    customer: order.user,
    scheduledDate,
    timeSlot,
    address: address || order.shippingAddress,
    deliveryAgent,
    specialInstructions,
    priority: priority || 'Normal',
    isContactless: isContactless || false,
    status: 'Scheduled',
    trackingUpdates: [
      {
        status: 'Scheduled',
        timestamp: new Date(),
        note: 'Delivery scheduled',
        updatedBy: req.user._id
      }
    ]
  });

  // Update order status to Shipped if it's currently Packed
  if (order.status === 'Packed') {
    order.status = 'Shipped';
    order.statusHistory.push({
      status: 'Shipped',
      date: new Date(),
      note: 'Order shipped for delivery',
      updatedBy: req.user._id
    });
    await order.save();
  }

  res.status(201).json({
    success: true,
    data: delivery
  });
});

/**
 * @desc    Get all deliveries with filters and pagination
 * @route   GET /api/deliveries
 * @access  Private (Admin/Staff only)
 */
exports.getAllDeliveries = asyncHandler(async (req, res, next) => {
  // Filtering
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);

  // Build query
  let query = Delivery.find(queryObj)
    .populate({
      path: 'order',
      select: 'orderNumber totalPrice paymentMethod'
    })
    .populate({
      path: 'customer',
      select: 'name email phone'
    })
    .populate({
      path: 'deliveryAgent',
      select: 'name email phone'
    });

  // Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-scheduledDate');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Delivery.countDocuments(queryObj);

  query = query.skip(startIndex).limit(limit);

  // Execute query
  const deliveries = await query;

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: deliveries.length,
    pagination,
    total,
    data: deliveries
  });
});

/**
 * @desc    Get delivery by ID
 * @route   GET /api/deliveries/:id
 * @access  Private (Admin/Staff/Customer)
 */
exports.getDeliveryById = asyncHandler(async (req, res, next) => {
  const delivery = await Delivery.findById(req.params.id)
    .populate({
      path: 'order',
      select: 'orderNumber totalPrice items status'
    })
    .populate({
      path: 'customer',
      select: 'name email phone'
    })
    .populate({
      path: 'deliveryAgent',
      select: 'name email phone'
    });

  if (!delivery) {
    return next(new ErrorResponse('Delivery not found', 404));
  }

  // Check if user has permission to view this delivery
  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'staff' &&
    delivery.customer.toString() !== req.user._id.toString()
  ) {
    return next(
      new ErrorResponse('Not authorized to access this delivery', 403)
    );
  }

  res.status(200).json({
    success: true,
    data: delivery
  });
});

/**
 * @desc    Update delivery status
 * @route   PUT /api/deliveries/:id/status
 * @access  Private (Admin/Staff/DeliveryAgent)
 */
exports.updateDeliveryStatus = asyncHandler(async (req, res, next) => {
  const { status, note, location } = req.body;

  if (!status) {
    return next(new ErrorResponse('Status is required', 400));
  }

  const delivery = await Delivery.findById(req.params.id);

  if (!delivery) {
    return next(new ErrorResponse('Delivery not found', 404));
  }

  // Validate status transition
  const validTransitions = {
    'Scheduled': ['In Transit', 'Cancelled'],
    'In Transit': ['Out for Delivery', 'Failed', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Failed', 'Rescheduled'],
    'Failed': ['Rescheduled', 'Cancelled'],
    'Rescheduled': ['Scheduled', 'Cancelled'],
    'Delivered': [],
    'Cancelled': []
  };

  if (!validTransitions[delivery.status].includes(status)) {
    return next(
      new ErrorResponse(
        `Invalid status transition from ${delivery.status} to ${status}`,
        400
      )
    );
  }

  // Update the status
  delivery.status = status;

  // Add status update to tracking
  delivery.trackingUpdates.push({
    status,
    timestamp: new Date(),
    location,
    note,
    updatedBy: req.user._id
  });

  // Handle specific status changes
  if (status === 'Delivered') {
    delivery.actualDeliveryTime = new Date();
  } else if (status === 'Failed') {
    delivery.failureReason = note;
    
    // Add attempt record
    delivery.attempts.push({
      date: new Date(),
      status: 'Failed',
      reason: note
    });
  }

  await delivery.save();

  res.status(200).json({
    success: true,
    data: delivery
  });
}); 