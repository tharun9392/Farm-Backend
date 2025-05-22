const express = require('express');
const router = express.Router();
const { 
  getAnnouncements, 
  createAnnouncement, 
  deleteAnnouncement, 
  resendAnnouncement 
} = require('../controllers/announcement.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Protect all routes and limit to admin only
router.use(protect);
router.use(authorize(['admin']));

// Get all announcements
router.get('/', getAnnouncements);

// Create new announcement
router.post('/', createAnnouncement);

// Delete announcement
router.delete('/:id', deleteAnnouncement);

// Resend an announcement
router.post('/:id/resend', resendAnnouncement);

module.exports = router; 