const { Payment, Order, User, Inventory } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { sendPaymentConfirmation } = require('../utils/emailService');
const { createNotificationUtil } = require('./notification.controller');

// Mock implementation for Razorpay when in development mode
const createMockRazorpay = () => {
  console.log('Creating mock Razorpay implementation for development');
  return {
    orders: {
      create: async (options) => {
        console.log('Mock Razorpay order creation:', options);
        return {
          id: `mock_order_${Date.now()}`,
          amount: options.amount,
          currency: options.currency,
          receipt: options.receipt,
          status: 'created'
        };
      },
      fetch: async (orderId) => {
        console.log(`Mock Razorpay order fetch: ${orderId}`);
        return {
          id: orderId,
          amount: 10000,
          currency: 'INR',
          receipt: `receipt_${orderId}`,
          status: 'paid'
        };
      }
    },
    payments: {
      fetch: async (paymentId) => {
        console.log(`Mock Razorpay payment fetch: ${paymentId}`);
        return {
          id: paymentId,
          order_id: `order_${Date.now()}`,
          amount: 10000,
          currency: 'INR',
          status: 'captured',
          method: 'card'
        };
      },
      refund: async (paymentId, options) => {
        console.log(`Mock Razorpay refund: ${paymentId}`, options);
        return {
          id: `rfnd_${Date.now()}`,
          payment_id: paymentId,
          amount: options.amount,
          currency: 'INR',
          status: 'processed'
        };
      }
    }
  };
};

// Initialize Razorpay conditionally
let razorpay;
try {
  const Razorpay = require('razorpay');
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  } else if (process.env.NODE_ENV === 'development') {
    // Use mock implementation in development
    razorpay = createMockRazorpay();
  } else {
    console.log('Razorpay credentials not found');
  }
} catch (error) {
  console.log('Razorpay initialization failed:', error.message);
  
  // Use mock implementation in development
  if (process.env.NODE_ENV === 'development') {
    razorpay = createMockRazorpay();
  }
}

/**
 * @desc    Create Razorpay order
 * @route   POST /api/payments/razorpay/create
 * @access  Private
 */
exports.createRazorpayOrder = asyncHandler(async (req, res, next) => {
  // Check if Razorpay is initialized
  if (!razorpay) {
    return next(new ErrorResponse('Payment gateway not configured', 503));
  }

  const { orderId } = req.body;

  // Validate input
  if (!orderId) {
    return next(new ErrorResponse('Order ID is required', 400));
  }

  // Find the order
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Check if this order has already been paid
  if (order.isPaid) {
    return next(new ErrorResponse('This order has already been paid for', 400));
  }

  // Check if the order belongs to the logged-in user
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to make payment for this order', 403));
  }

  // Create Razorpay order
  const options = {
    amount: Math.round(order.totalPrice * 100), // Razorpay expects amount in paise
    currency: 'INR',
    receipt: `receipt_${order._id}`,
    payment_capture: 1, // Auto-capture enabled
    notes: {
      orderNumber: order.orderNumber,
      userId: req.user._id.toString()
    }
  };

  try {
    const razorpayOrder = await razorpay.orders.create(options);

    // Create a pending payment record
    const payment = await Payment.create({
      paymentType: 'customer-payment',
      user: req.user._id,
      order: orderId,
      amount: order.totalPrice,
      currency: 'INR',
      status: 'pending',
      paymentGateway: 'Razorpay',
      transactionId: razorpayOrder.id,
      description: `Payment for order #${order.orderNumber}`,
      analytics: {
        attemptCount: 1,
        lastAttemptDate: new Date()
      }
    });

    // After successful payment initialization, send notification
    try {
      await createNotificationUtil({
        user: req.user._id,
        title: 'Payment Initiated',
        message: `Your payment of ₹${payment.amount.toFixed(2)} has been initiated for order #${order.orderNumber}.`,
        type: 'payment',
        actionLink: `/customer/orders/${order._id}`,
        priority: 'normal'
      });
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // Continue processing even if notification fails
    }

    res.status(200).json({
      success: true,
      data: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        orderId: order._id,
        receipt: razorpayOrder.receipt,
        paymentId: payment._id
      }
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    return next(new ErrorResponse('Payment gateway error', 500));
  }
});

/**
 * @desc    Verify Razorpay payment
 * @route   POST /api/payments/razorpay/verify
 * @access  Private
 */
exports.verifyRazorpayPayment = asyncHandler(async (req, res, next) => {
  // Check if Razorpay is initialized
  if (!razorpay) {
    return next(new ErrorResponse('Payment gateway not configured', 503));
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentId } = req.body;

  // Validate input
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return next(new ErrorResponse('All fields are required', 400));
  }

  // Verify the signature
  const signatureString = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(signatureString)
    .digest('hex');

  // If the signatures don't match, payment is not genuine
  if (expectedSignature !== razorpay_signature) {
    return next(new ErrorResponse('Invalid payment signature', 400));
  }

  try {
    // Find the payment record
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return next(new ErrorResponse('Payment record not found', 404));
    }

    // Update payment record
    payment.status = 'completed';
    payment.paymentDate = new Date();
    payment.transactionId = razorpay_payment_id;
    await payment.save();

    // Get payment details from Razorpay for analytics
    const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    
    // Update analytics data
    payment.analytics = {
      ...payment.analytics,
      processingTime: new Date() - new Date(payment.createdAt),
      device: req.headers['user-agent'],
      ipAddress: req.ip
    };
    await payment.save();

    // Generate invoice
    await generateInvoice(payment._id);

    // Try to send confirmation email and notification
    try {
      // Find order details
      const order = await Order.findById(payment.order);
      
      // After successful payment, send notification
      await createNotificationUtil({
        user: req.user._id,
        title: 'Payment Successful',
        message: `Your payment of ₹${payment.amount.toFixed(2)} has been successfully processed for order #${order ? order.orderNumber : 'Unknown'}.`,
        type: 'payment',
        actionLink: `/customer/orders/${payment.order}`,
        priority: 'normal'
      });
      
      // Try to send email
      try {
        await sendPaymentConfirmation(req.user, payment, order);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Continue processing even if email fails
      }
    } catch (notificationError) {
      console.error('Notification creation failed:', notificationError);
      // Continue processing even if notification fails
    }

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        transactionId: razorpay_payment_id,
        orderId: payment.order,
        amount: payment.amount,
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return next(new ErrorResponse('Error processing payment verification', 500));
  }
});

/**
 * @desc    Get payment by ID
 * @route   GET /api/payments/:id
 * @access  Private
 */
exports.getPaymentById = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id)
    .populate('user', 'name email')
    .populate('order', 'orderNumber totalPrice items');

  if (!payment) {
    return next(new ErrorResponse('Payment not found', 404));
  }

  // Authorize - only the payment user or admin can access this
  if (payment.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to access this payment', 403));
  }

  res.status(200).json({
    success: true,
    data: payment
  });
});

/**
 * @desc    Get user's payments
 * @route   GET /api/payments/my-payments
 * @access  Private
 */
exports.getMyPayments = asyncHandler(async (req, res, next) => {
  const payments = await Payment.find({ user: req.user._id })
    .populate('order', 'orderNumber totalPrice status')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});

/**
 * @desc    Get all payments (admin only)
 * @route   GET /api/payments
 * @access  Private (Admin)
 */
exports.getAllPayments = asyncHandler(async (req, res, next) => {
  // Build query
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource
  query = Payment.find(JSON.parse(queryStr));

  // Select fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Payment.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Populate
  query = query.populate('user', 'name email').populate('order', 'orderNumber totalPrice items status');

  // Execute query
  const payments = await query;

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
    count: payments.length,
    pagination,
    data: payments
  });
});

/**
 * @desc    Process refund
 * @route   POST /api/payments/:id/refund
 * @access  Private (Admin)
 */
exports.processRefund = asyncHandler(async (req, res, next) => {
  const { reason, amount } = req.body;
  
  // Validate input
  if (!reason) {
    return next(new ErrorResponse('Refund reason is required', 400));
  }

  // Find the payment
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    return next(new ErrorResponse('Payment not found', 404));
  }

  // Check if payment can be refunded
  if (payment.status !== 'completed') {
    return next(new ErrorResponse(`Cannot refund a payment with status: ${payment.status}`, 400));
  }

  // Check if payment is already refunded
  if (payment.status === 'refunded') {
    return next(new ErrorResponse('This payment has already been refunded', 400));
  }

  try {
    // If the payment was made through Razorpay
    if (payment.paymentGateway === 'Razorpay' && payment.transactionId) {
      // Determine refund amount
      const refundAmount = amount || payment.amount;
      
      // Process refund through Razorpay
      const refund = await razorpay.payments.refund(payment.transactionId, {
        amount: Math.round(refundAmount * 100), // In paise
        notes: {
          reason,
          orderId: payment.order ? payment.order.toString() : null,
          refundBy: req.user._id.toString()
        }
      });

      // Update payment with refund details
      payment.status = 'refunded';
      payment.refundDetails = {
        refundDate: new Date(),
        refundAmount: refundAmount,
        refundReason: reason,
        refundedBy: req.user._id,
        refundTransactionId: refund.id,
        refundStatus: 'completed',
        refundMethod: 'Razorpay'
      };

      await payment.save();

      // If this is for an order, update the order status
      if (payment.order) {
        await Order.findByIdAndUpdate(payment.order, {
          status: 'Refunded',
          isRefunded: true,
          refundedAt: new Date()
        });
      }

      // After successful refund:
      // Send refund confirmation email
      await sendPaymentConfirmation(req.user, payment, payment.order);

      // Create in-app notification
      await createNotificationUtil({
        user: req.user._id,
        title: 'Refund Successful',
        message: `Your refund of ₹${refundAmount.toFixed(2)} has been successfully processed for order #${payment.order.orderNumber}.`,
        type: 'refund',
        actionLink: `/customer/orders/${payment.order._id}`,
        priority: 'normal'
      });

      res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          refundId: refund.id,
          amount: refundAmount,
          status: 'refunded'
        }
      });
    } else {
      // Manual refund process for other payment methods
      payment.status = 'refunded';
      payment.refundDetails = {
        refundDate: new Date(),
        refundAmount: amount || payment.amount,
        refundReason: reason,
        refundedBy: req.user._id,
        refundStatus: 'completed',
        refundMethod: 'Manual'
      };

      await payment.save();

      // If this is for an order, update the order status
      if (payment.order) {
        await Order.findByIdAndUpdate(payment.order, {
          status: 'Refunded',
          isRefunded: true,
          refundedAt: new Date()
        });
      }

      // After successful refund:
      // Send refund confirmation email
      await sendPaymentConfirmation(req.user, payment, payment.order);

      // Create in-app notification
      await createNotificationUtil({
        user: req.user._id,
        title: 'Refund Successful',
        message: `Your refund of ₹${amount?.toFixed(2) || payment.amount.toFixed(2)} has been successfully processed for order #${payment.order.orderNumber}.`,
        type: 'refund',
        actionLink: `/customer/orders/${payment.order._id}`,
        priority: 'normal'
      });

      res.status(200).json({
        success: true,
        data: {
          paymentId: payment._id,
          amount: amount || payment.amount,
          status: 'refunded'
        }
      });
    }
  } catch (error) {
    console.error('Refund processing error:', error);
    return next(new ErrorResponse('Error processing refund', 500));
  }
});

/**
 * @desc    Generate invoice
 * @route   POST /api/payments/:id/invoice
 * @access  Private (Admin & Owner)
 */
exports.generateInvoiceEndpoint = asyncHandler(async (req, res, next) => {
  const paymentId = req.params.id;
  
  try {
    const invoiceData = await generateInvoice(paymentId);
    
    res.status(200).json({
      success: true,
      data: invoiceData
    });
  } catch (error) {
    console.error('Invoice generation error:', error);
    return next(new ErrorResponse('Error generating invoice', 500));
  }
});

/**
 * @desc    Get payment analytics
 * @route   GET /api/payments/analytics
 * @access  Private (Admin)
 */
exports.getPaymentAnalytics = asyncHandler(async (req, res, next) => {
  // Get date range from query params
  const { startDate, endDate } = req.query;
  
  const matchQuery = {};
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  // Total payments and amount
  const totalStats = await Payment.aggregate([
    { $match: { ...matchQuery, status: 'completed' } },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);

  // Payments by type
  const paymentsByType = await Payment.aggregate([
    { $match: { ...matchQuery, status: 'completed' } },
    {
      $group: {
        _id: '$paymentType',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Payments by gateway
  const paymentsByGateway = await Payment.aggregate([
    { $match: { ...matchQuery, status: 'completed' } },
    {
      $group: {
        _id: '$paymentGateway',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Payments over time (daily)
  const paymentsOverTime = await Payment.aggregate([
    { $match: { ...matchQuery, status: 'completed' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Refund stats
  const refundStats = await Payment.aggregate([
    { $match: { ...matchQuery, status: 'refunded' } },
    {
      $group: {
        _id: null,
        totalRefunded: { $sum: '$refundDetails.refundAmount' },
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      total: totalStats.length ? totalStats[0] : { totalAmount: 0, count: 0, avgAmount: 0 },
      byType: paymentsByType,
      byGateway: paymentsByGateway,
      overTime: paymentsOverTime,
      refunds: refundStats.length ? refundStats[0] : { totalRefunded: 0, count: 0 }
    }
  });
});

/**
 * Helper function to generate invoice
 * @param {string} paymentId - Payment ID
 * @returns {Object} Invoice data
 */
const generateInvoice = async (paymentId) => {
  // Find the payment with order details
  const payment = await Payment.findById(paymentId)
    .populate({
      path: 'order',
      populate: {
        path: 'items.product',
        model: 'Product',
        select: 'name description'
      }
    })
    .populate('user', 'name email address phone');

  if (!payment) {
    throw new Error('Payment not found');
  }

  if (!payment.order) {
    throw new Error('This payment is not associated with an order');
  }

  // Generate invoice number
  const invoiceNumber = `INV-${payment.order.orderNumber}-${Date.now().toString().slice(-4)}`;
  
  // Create invoice items from order items
  const invoiceItems = payment.order.items.map(item => ({
    name: item.name,
    description: `${item.name} - Rice Product`,
    quantity: item.quantity,
    unitPrice: item.price,
    totalPrice: item.price * item.quantity,
    taxRate: 5, // 5% GST
    taxAmount: (item.price * item.quantity * 0.05)
  }));

  // Calculate invoice totals
  const subtotal = payment.order.itemsPrice;
  const taxTotal = payment.order.taxPrice;
  const total = payment.order.totalPrice;

  // Create the invoice record
  const invoiceData = {
    invoiceNumber,
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
    items: invoiceItems,
    subtotal,
    taxTotal,
    discount: 0,
    total,
    paidAmount: payment.status === 'completed' ? total : 0,
    balanceDue: payment.status === 'completed' ? 0 : total,
    notes: 'Thank you for your business!',
    terms: 'Payment due within 7 days.',
    status: payment.status === 'completed' ? 'paid' : 'sent'
  };

  // Update payment with invoice data
  payment.invoice = invoiceData;
  await payment.save();

  // Generate PDF invoice
  const pdfBuffer = await generatePdfInvoice(payment, invoiceData);
  
  // Save PDF to disk or use a storage service in a real production environment
  // Here we're simulating a URL that would be returned
  const pdfUrl = `/invoices/${invoiceNumber}.pdf`;
  
  // Update payment with PDF URL
  payment.invoice.pdfUrl = pdfUrl;
  await payment.save();

  return {
    invoice: payment.invoice,
    pdfUrl
  };
};

/**
 * Helper function to generate PDF invoice
 * @param {Object} payment - Payment object
 * @param {Object} invoiceData - Invoice data
 * @returns {Buffer} PDF buffer
 */
const generatePdfInvoice = async (payment, invoiceData) => {
  // In a real production application, this would generate a PDF
  // For now, we'll just return a mock buffer
  
  // This is placeholder code. In a real app, you would:
  // 1. Create a PDF using a library like PDFKit
  // 2. Save it to a file or cloud storage
  // 3. Return the file path or URL
  
  return Buffer.from('Mock PDF invoice');
};

/**
 * @desc    Create payment for farmer
 * @route   POST /api/payments/farmer
 * @access  Private (Admin)
 */
exports.createFarmerPayment = asyncHandler(async (req, res, next) => {
  const {
    farmerId,
    amount,
    inventoryId,
    paymentMethod,
    description,
    bankDetails,
    riceQuantity,
    ratePerKg
  } = req.body;

  // Validate input
  if (!farmerId || !amount || !paymentMethod) {
    return next(new ErrorResponse('Farmer ID, amount, and payment method are required', 400));
  }

  // Check if farmer exists
  const farmer = await User.findById(farmerId);
  if (!farmer || farmer.role !== 'farmer') {
    return next(new ErrorResponse('Farmer not found', 404));
  }

  // Check inventory if provided
  if (inventoryId) {
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return next(new ErrorResponse('Inventory not found', 404));
    }
  }

  // Create payment
  const payment = await Payment.create({
    paymentType: 'farmer-payment',
    user: farmerId,
    inventory: inventoryId,
    amount,
    paymentMethod,
    description: description || `Payment to farmer for rice purchase`,
    status: 'completed',
    paymentDate: new Date(),
    paymentGateway: paymentMethod,
    farmerPaymentDetails: {
      riceQuantity,
      ratePerKg,
      paymentMethod,
      bankDetails
    }
  });

  // Generate simple invoice for farmer payment
  await generateFarmerInvoice(payment._id);

  res.status(201).json({
    success: true,
    data: payment
  });
});

/**
 * Helper function to generate farmer invoice
 * @param {string} paymentId - Payment ID
 * @returns {Object} Invoice data
 */
const generateFarmerInvoice = async (paymentId) => {
  // Find the payment with inventory details
  const payment = await Payment.findById(paymentId)
    .populate('inventory')
    .populate('user', 'name email address phone farmDetails');

  if (!payment) {
    throw new Error('Payment not found');
  }

  // Generate invoice number
  const invoiceNumber = `FP-${Date.now().toString()}-${payment._id.toString().substring(0, 5)}`;
  
  // Calculate tax
  const taxRate = 0; // Can be adjusted based on business logic
  const taxAmount = payment.amount * (taxRate / 100);
  
  // Create the invoice record
  const invoiceData = {
    invoiceNumber,
    invoiceDate: new Date(),
    dueDate: new Date(), // Immediate due date for already paid invoices
    items: [{
      name: 'Rice Purchase',
      description: `Purchase of ${payment.farmerPaymentDetails?.riceQuantity || 'N/A'} kg rice at ₹${payment.farmerPaymentDetails?.ratePerKg || 'N/A'}/kg`,
      quantity: payment.farmerPaymentDetails?.riceQuantity || 1,
      unitPrice: payment.farmerPaymentDetails?.ratePerKg || payment.amount,
      totalPrice: payment.amount,
      taxRate: taxRate,
      taxAmount: taxAmount
    }],
    subtotal: payment.amount,
    taxTotal: taxAmount,
    discount: 0,
    total: payment.amount + taxAmount,
    paidAmount: payment.amount + taxAmount,
    balanceDue: 0,
    notes: 'Thank you for supplying rice to our platform!',
    terms: 'Payment completed',
    status: 'paid'
  };

  // Update payment with invoice data
  payment.invoice = invoiceData;
  await payment.save();

  return {
    invoice: payment.invoice
  };
}; 