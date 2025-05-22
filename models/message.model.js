const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    conversationId: {
      type: String,
      required: true
    },
    attachments: [
      {
        name: String,
        fileUrl: String,
        fileType: String
      }
    ]
  },
  {
    timestamps: true
  }
);

// Create indexes for faster queries
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ conversationId: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ isRead: 1 });

// Static method to generate a unique conversation ID between two users
messageSchema.statics.generateConversationId = function(userId1, userId2) {
  // Sort the IDs to ensure consistency regardless of who initiates the conversation
  const sortedIds = [userId1, userId2].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 