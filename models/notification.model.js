const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'order', 
      'payment', 
      'inventory', 
      'account', 
      'system', 
      'message',
      'low-stock',
      'delivery',
      'quality'
    ],
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  actionLink: {
    type: String
  },
  reference: {
    model: {
      type: String,
      enum: ['Order', 'Payment', 'Inventory', 'User', 'Product', 'Delivery']
    },
    id: {
      type: Schema.Types.ObjectId
    }
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  icon: {
    type: String
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Create indexes for faster querying
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ createdAt: 1 });
notificationSchema.index({ type: 1 });

// Set TTL index for auto-expiry after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 