const Notification = require('../models/notification.model');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const startIndex = (page - 1) * limit;

  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .skip(startIndex)
    .limit(limit);

  const total = await Notification.countDocuments({ recipient: req.user._id });

  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    totalPages: Math.ceil(total / limit),
    data: notifications
  });
});

/**
 * @desc    Mark notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res, next) => {
  let notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new ErrorResponse('Notification not found', 404));
  }

  // Check if notification belongs to the logged-in user
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized to update this notification', 403));
  }

  notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { read: true },
    { new: true }
  );

  res.status(200).json({
    success: true,
    data: notification
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = asyncHandler(async (req, res, next) => {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { read: true }
  );

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read'
  });
});

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
exports.deleteNotification = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return next(new ErrorResponse('Notification not found', 404));
  }

  // Check if notification belongs to the logged-in user
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized to delete this notification', 403));
  }

  await notification.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
exports.getUnreadCount = asyncHandler(async (req, res, next) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    read: false
  });

  res.status(200).json({
    success: true,
    data: { count }
  });
});

/**
 * @desc    Create notification (admin only)
 * @route   POST /api/notifications
 * @access  Private (Admin)
 */
exports.createNotification = asyncHandler(async (req, res, next) => {
  // Only admin can create notifications for other users
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to create notifications', 403));
  }

  const { recipient, title, message, type, link, metadata } = req.body;

  if (!recipient || !title || !message || !type) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  const notification = await Notification.create({
    recipient,
    title,
    message,
    type,
    link,
    metadata
  });

  res.status(201).json({
    success: true,
    data: notification
  });
});

/**
 * Utility function to create a notification (for internal use)
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} - Created notification
 */
exports.createNotificationUtil = async (notificationData) => {
  try {
    const notification = await Notification.create(notificationData);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}; 