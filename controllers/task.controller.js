const { Task, User } = require('../models');

/**
 * Create a new task
 * @route POST /api/tasks
 * @access Private (Admin only)
 */
const createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      assignedTo,
      priority,
      dueDate,
      category,
      relatedTo,
      relatedToModel
    } = req.body;
    
    // Check if the assigned user exists and is staff
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found'
      });
    }
    
    if (assignedUser.role !== 'staff' && assignedUser.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Tasks can only be assigned to staff or admin users'
      });
    }
    
    // Create the task
    const task = new Task({
      title,
      description,
      assignedTo,
      assignedBy: req.user._id,
      priority,
      dueDate,
      category,
      relatedTo,
      relatedToModel
    });
    
    await task.save();
    
    // Populate the response
    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email role');
    
    res.status(201).json({
      success: true,
      data: populatedTask
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all tasks with filters
 * @route GET /api/tasks
 * @access Private (Admin/Staff)
 */
const getAllTasks = async (req, res, next) => {
  try {
    // Build query from request params
    const query = {};
    const { status, priority, category, assignedTo, dueDate } = req.query;
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (assignedTo) query.assignedTo = assignedTo;
    
    // Filter tasks by due date range
    if (dueDate) {
      const today = new Date();
      if (dueDate === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query.dueDate = { $gte: today, $lt: tomorrow };
      } else if (dueDate === 'week') {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        query.dueDate = { $gte: today, $lt: nextWeek };
      } else if (dueDate === 'overdue') {
        query.dueDate = { $lt: today };
        query.status = { $ne: 'completed' };
      }
    }
    
    // If staff, only show their tasks
    if (req.user.role === 'staff') {
      query.assignedTo = req.user._id;
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Execute query
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Task.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: tasks.length,
      total,
      pages: Math.ceil(total / limit),
      data: tasks
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single task by ID
 * @route GET /api/tasks/:id
 * @access Private (Admin/Staff)
 */
const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('notes.addedBy', 'name role');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Staff can only view their own tasks
    if (req.user.role === 'staff' && task.assignedTo._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this task'
      });
    }
    
    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a task
 * @route PUT /api/tasks/:id
 * @access Private (Admin/Staff)
 */
const updateTask = async (req, res, next) => {
  try {
    // Find the task
    let task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check authorization (admin can edit any task, staff can only update their own task status)
    if (req.user.role === 'staff') {
      if (task.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this task'
        });
      }
      
      // Staff can only update status and add notes
      const { status, note } = req.body;
      
      if (status) task.status = status;
      
      // If status changed to completed, add completion date
      if (status === 'completed' && task.status !== 'completed') {
        task.completedAt = new Date();
      }
      
      // Add note if provided
      if (note) {
        task.notes.push({
          note,
          addedBy: req.user._id
        });
      }
    } else {
      // Admin can update any field
      const {
        title,
        description,
        assignedTo,
        priority,
        status,
        dueDate,
        category,
        note
      } = req.body;
      
      // Check if new assignee exists and is staff
      if (assignedTo && assignedTo !== task.assignedTo.toString()) {
        const assignedUser = await User.findById(assignedTo);
        if (!assignedUser) {
          return res.status(404).json({
            success: false,
            message: 'Assigned user not found'
          });
        }
        
        if (assignedUser.role !== 'staff' && assignedUser.role !== 'admin') {
          return res.status(400).json({
            success: false,
            message: 'Tasks can only be assigned to staff or admin users'
          });
        }
        
        task.assignedTo = assignedTo;
      }
      
      if (title) task.title = title;
      if (description) task.description = description;
      if (priority) task.priority = priority;
      if (status) {
        task.status = status;
        // If status changed to completed, add completion date
        if (status === 'completed' && task.status !== 'completed') {
          task.completedAt = new Date();
        }
      }
      if (dueDate) task.dueDate = dueDate;
      if (category) task.category = category;
      
      // Add note if provided
      if (note) {
        task.notes.push({
          note,
          addedBy: req.user._id
        });
      }
    }
    
    // Save the task
    await task.save();
    
    // Populate the response
    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('notes.addedBy', 'name role');
    
    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a task
 * @route DELETE /api/tasks/:id
 * @access Private (Admin only)
 */
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    await task.remove();
    
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a note to a task
 * @route POST /api/tasks/:id/notes
 * @access Private (Admin/Staff)
 */
const addTaskNote = async (req, res, next) => {
  try {
    const { note } = req.body;
    
    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }
    
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Staff can only add notes to their own tasks
    if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add notes to this task'
      });
    }
    
    task.notes.push({
      note,
      addedBy: req.user._id
    });
    
    await task.save();
    
    // Populate the response
    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('notes.addedBy', 'name role');
    
    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get task metrics/statistics
 * @route GET /api/tasks/metrics
 * @access Private (Admin/Staff)
 */
const getTaskMetrics = async (req, res, next) => {
  try {
    let filter = {};
    
    // If user is staff, only show their metrics
    if (req.user.role === 'staff') {
      filter = { assignedTo: req.user._id };
    }
    
    // Overall task counts by status
    const statusCounts = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Tasks by priority
    const priorityCounts = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Tasks by category
    const categoryCounts = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Overdue tasks
    const now = new Date();
    const overdueTasks = await Task.countDocuments({
      ...filter,
      dueDate: { $lt: now },
      status: { $ne: 'completed' }
    });
    
    // Tasks due today
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const dueTodayTasks = await Task.countDocuments({
      ...filter,
      dueDate: { $gte: today, $lt: tomorrow },
      status: { $ne: 'completed' }
    });
    
    // Format the metrics in a more user-friendly way
    const formattedStatusCounts = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    
    const formattedPriorityCounts = priorityCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    
    const formattedCategoryCounts = categoryCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      data: {
        statusCounts: formattedStatusCounts,
        priorityCounts: formattedPriorityCounts,
        categoryCounts: formattedCategoryCounts,
        overdueTasks,
        dueTodayTasks
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getAllTasks,
  getTaskById,
  updateTask,
  deleteTask,
  addTaskNote,
  getTaskMetrics
}; 