const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  sendMessage,
  getConversation,
  getConversations,
  markAsRead,
  getUnreadCount,
  getAdminConversations
} = require('../controllers/message.controller');

// Get all conversations for the current user
router.get('/conversations', protect, getConversations);

// Get all conversations for admin
router.get('/admin/conversations', protect, authorize(['admin']), getAdminConversations);

// Get specific conversation with another user
router.get('/conversation/:userId', protect, getConversation);

// Get count of unread messages
router.get('/unread/count', protect, getUnreadCount);

// Send a new message
router.post('/', protect, authorize(['farmer', 'admin']), sendMessage);

// Mark a message as read
router.put('/:id/read', protect, markAsRead);

module.exports = router; 