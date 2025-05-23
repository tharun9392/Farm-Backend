const { Message, User } = require('../models');
const mongoose = require('mongoose');

/**
 * Send a new message
 * @route POST /api/messages
 * @access Private
 */
const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, content, attachments = [] } = req.body;
    const senderId = req.user._id;

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Validate receiver role (farmers can only message admins and vice versa)
    if (req.user.role === 'farmer' && receiver.role !== 'admin') {
      return res.status(403).json({ message: 'Farmers can only send messages to admins' });
    }
    
    if (req.user.role === 'admin' && receiver.role !== 'farmer') {
      return res.status(403).json({ message: 'Admins can only send messages to farmers' });
    }

    // Generate conversation ID
    const conversationId = Message.generateConversationId(senderId, receiverId);

    // Create a new message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      conversationId,
      attachments
    });

    await message.save();

    // Populate sender and receiver info for response
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar role')
      .populate('receiver', 'name avatar role');

    res.status(201).json({
      message: 'Message sent successfully',
      data: populatedMessage
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get conversation between two users
 * @route GET /api/messages/conversation/:userId
 * @access Private
 */
const getConversation = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate conversation ID
    const conversationId = Message.generateConversationId(currentUserId, userId);

    // Get messages for the conversation with pagination
    const { page = 1, limit = 20 } = req.query;
    
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sender', 'name avatar role')
      .populate('receiver', 'name avatar role');

    // Get total count
    const total = await Message.countDocuments({ conversationId });

    // Mark unread messages as read if current user is the receiver
    await Message.updateMany(
      { 
        conversationId,
        receiver: currentUserId,
        isRead: false
      },
      { isRead: true }
    );

    res.json({
      messages: messages.reverse(), // Reverse to get chronological order
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all conversations (list of users the current user has messaged)
 * @route GET /api/messages/conversations
 * @access Private
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Get all unique conversations where the user is either sender or receiver
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: mongoose.Types.ObjectId.createFromHexString(userId) },
            { receiver: mongoose.Types.ObjectId.createFromHexString(userId) }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$receiver', mongoose.Types.ObjectId.createFromHexString(userId)] },
                  { $eq: ['$isRead', false] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Get the other user in each conversation
    const conversationsWithUsers = await Promise.all(conversations.map(async (conv) => {
      const lastMessage = conv.lastMessage;
      const otherUserId = lastMessage.sender.toString() === userId.toString() 
        ? lastMessage.receiver 
        : lastMessage.sender;
      
      const otherUser = await User.findById(otherUserId).select('name avatar role');
      
      return {
        conversationId: conv._id,
        otherUser,
        lastMessage: {
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
          senderId: lastMessage.sender,
          isRead: lastMessage.isRead
        },
        unreadCount: conv.unreadCount
      };
    }));

    res.json({ conversations: conversationsWithUsers });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all conversations for admin (list of all conversations in the system)
 * @route GET /api/messages/admin/conversations
 * @access Private (Admin only)
 */
const getAdminConversations = async (req, res, next) => {
  try {
    // Get all unique conversations
    const conversations = await Message.aggregate([
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $eq: ['$isRead', false] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Get both users in each conversation
    const conversationsWithUsers = await Promise.all(conversations.map(async (conv) => {
      const lastMessage = conv.lastMessage;
      
      const [user1, user2] = await Promise.all([
        User.findById(lastMessage.sender).select('name avatar role'),
        User.findById(lastMessage.receiver).select('name avatar role')
      ]);
      
      return {
        conversationId: conv._id,
        users: [user1, user2],
        lastMessage: {
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
          senderId: lastMessage.sender,
          isRead: lastMessage.isRead
        },
        unreadCount: conv.unreadCount
      };
    }));

    res.json({ conversations: conversationsWithUsers });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark message as read
 * @route PUT /api/messages/:id/read
 * @access Private
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const message = await Message.findById(id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Only the receiver can mark a message as read
    if (message.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized action' });
    }
    
    message.isRead = true;
    await message.save();
    
    res.json({ message: 'Message marked as read', data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread message count
 * @route GET /api/messages/unread/count
 * @access Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const count = await Message.countDocuments({
      receiver: userId,
      isRead: false
    });
    
    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getConversation,
  getConversations,
  getAdminConversations,
  markAsRead,
  getUnreadCount
}; 