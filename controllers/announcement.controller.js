const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const { sendAnnouncement } = require('../utils/emailService');

/**
 * @desc    Get all announcements
 * @route   GET /api/announcements
 * @access  Private (Admin)
 */
exports.getAnnouncements = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;

  // In a real implementation, you would have an Announcement model
  // This is a placeholder to demonstrate the structure
  const announcements = [];
  const total = 0;

  res.status(200).json({
    success: true,
    count: announcements.length,
    total,
    totalPages: Math.ceil(total / limit),
    data: announcements
  });
});

/**
 * @desc    Create and send announcement
 * @route   POST /api/announcements
 * @access  Private (Admin)
 */
exports.createAnnouncement = asyncHandler(async (req, res, next) => {
  const { title, content, sendTo, priority } = req.body;

  if (!title || !content) {
    return next(new ErrorResponse('Please provide title and content for the announcement', 400));
  }

  // Get users based on sendTo filter
  let query = {};
  if (sendTo === 'farmers') {
    query.role = 'farmer';
  } else if (sendTo === 'customers') {
    query.role = 'customer';
  } else if (sendTo === 'staff') {
    query.role = 'staff';
  }

  const users = await User.find(query).select('email name');
  
  if (users.length === 0) {
    return next(new ErrorResponse('No recipients found matching the criteria', 400));
  }

  // Create announcement object
  const announcement = {
    title,
    content,
    sentBy: req.user,
    priority: priority || 'normal'
  };

  // Send email to all recipients
  await sendAnnouncement(users, announcement);

  // In a real implementation, you would save the announcement to the database
  // and create notifications for each user
  // Here we're just demonstrating the email sending part

  res.status(201).json({
    success: true,
    message: `Announcement sent to ${users.length} recipients`,
    data: {
      title,
      content,
      sentBy: {
        name: req.user.name,
        id: req.user._id
      },
      recipients: {
        type: sendTo,
        count: users.length
      },
      priority
    }
  });
});

/**
 * @desc    Delete an announcement
 * @route   DELETE /api/announcements/:id
 * @access  Private (Admin)
 */
exports.deleteAnnouncement = asyncHandler(async (req, res, next) => {
  // In a real implementation, you would delete the announcement from the database
  // This is a placeholder to demonstrate the structure

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Resend an announcement
 * @route   POST /api/announcements/:id/resend
 * @access  Private (Admin)
 */
exports.resendAnnouncement = asyncHandler(async (req, res, next) => {
  // In a real implementation, you would retrieve the announcement and resend it
  // This is a placeholder to demonstrate the structure

  res.status(200).json({
    success: true,
    message: 'Announcement resent successfully'
  });
}); 