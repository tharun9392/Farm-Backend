const express = require('express');
const router = express.Router();
const { protect, isStaffOrAdmin, isAdmin } = require('../middleware/auth.middleware');
const {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  addTaskNote,
  getTaskMetrics
} = require('../controllers/task.controller');

// Debug middleware for logging auth information
const logAuth = (req, res, next) => {
  console.log('Task Route Auth Debug:', {
    url: req.originalUrl,
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
    user: req.user ? {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    } : 'No user found in request'
  });
  next();
};

// Base route: /api/tasks

// Get task metrics
router.get('/metrics', protect, logAuth, isStaffOrAdmin, getTaskMetrics);

// Get all tasks with filters
router.get('/', protect, logAuth, isStaffOrAdmin, getAllTasks);

// Create a new task
router.post('/', protect, logAuth, isAdmin, createTask);

// Get, update, or delete a task by ID
router.get('/:id', protect, logAuth, isStaffOrAdmin, getTaskById);
router.put('/:id', protect, logAuth, isStaffOrAdmin, updateTask);
router.delete('/:id', protect, logAuth, isAdmin, deleteTask);

// Add a note to a task
router.post('/:id/notes', protect, logAuth, isStaffOrAdmin, addTaskNote);

module.exports = router; 