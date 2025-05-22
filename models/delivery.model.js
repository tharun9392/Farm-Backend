const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const deliverySchema = new Schema({
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order reference is required']
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer reference is required']
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled delivery date is required']
  },
  timeSlot: {
    start: { type: String },
    end: { type: String }
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    landmark: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  status: {
    type: String,
    enum: [
      'Scheduled',
      'In Transit',
      'Out for Delivery',
      'Delivered',
      'Failed',
      'Rescheduled',
      'Cancelled'
    ],
    default: 'Scheduled'
  },
  deliveryAgent: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  vehicle: {
    type: {
      type: String,
      enum: ['Bike', 'Car', 'Van', 'Truck']
    },
    number: String,
    description: String
  },
  trackingUpdates: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    location: String,
    note: String,
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  estimatedArrival: {
    type: Date
  },
  actualDeliveryTime: {
    type: Date
  },
  deliveryProof: {
    image: { type: String },
    signature: { type: String },
    notes: { type: String }
  },
  customerFeedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String }
  },
  specialInstructions: {
    type: String
  },
  failureReason: {
    type: String
  },
  attempts: [{
    date: { type: Date },
    status: { type: String },
    reason: { type: String },
    notes: { type: String }
  }],
  priority: {
    type: String,
    enum: ['Low', 'Normal', 'High', 'Express'],
    default: 'Normal'
  },
  tags: [String],
  isContactless: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add indexes for faster querying
deliverySchema.index({ order: 1 });
deliverySchema.index({ customer: 1 });
deliverySchema.index({ scheduledDate: 1 });
deliverySchema.index({ status: 1 });
deliverySchema.index({ 'address.postalCode': 1 });

// Middleware to update corresponding order when delivery is marked as delivered
deliverySchema.pre('save', async function(next) {
  try {
    // If delivery status changed to Delivered
    if (this.isModified('status') && this.status === 'Delivered') {
      this.actualDeliveryTime = new Date();
      
      // Update the order
      const Order = mongoose.model('Order');
      await Order.findByIdAndUpdate(this.order, {
        status: 'Delivered',
        isDelivered: true,
        deliveredAt: new Date(),
        $push: {
          statusHistory: {
            status: 'Delivered',
            date: new Date(),
            note: 'Delivery completed',
            updatedBy: this.deliveryAgent
          }
        }
      });
    }
    next();
  } catch (err) {
    next(err);
  }
});

const Delivery = mongoose.model('Delivery', deliverySchema);

module.exports = Delivery; 