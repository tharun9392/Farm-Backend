const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity cannot be less than 1']
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    type: String
  },
  farmer: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  farmerName: {
    type: String
  }
});

const shippingAddressSchema = new Schema({
  fullName: {
    type: String,
    required: true
  },
  addressLine1: {
    type: String,
    required: true
  },
  addressLine2: {
    type: String
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  postalCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true,
    default: 'India'
  },
  phoneNumber: {
    type: String,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
});

const orderSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: [orderItemSchema],
  shippingAddress: shippingAddressSchema,
  paymentMethod: {
    type: String,
    required: true,
    enum: ['Credit Card', 'Debit Card', 'UPI', 'Cash on Delivery', 'Net Banking']
  },
  paymentResult: {
    id: { type: String },
    status: { type: String },
    updateTime: { type: String },
    emailAddress: { type: String }
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  status: {
    type: String,
    required: true,
    enum: [
      'Pending', // Initial state when order is created but not confirmed
      'Processing', // Order confirmed, payment received or COD selected
      'Packed', // Items have been packed
      'Shipped', // Order has been shipped
      'Out for Delivery', // Order is out for delivery
      'Delivered', // Order has been delivered
      'Cancelled', // Order has been cancelled
      'Returned', // Order has been returned
      'Refunded' // Refund has been processed
    ],
    default: 'Pending'
  },
  statusHistory: [
    {
      status: {
        type: String,
        enum: [
          'Pending',
          'Processing',
          'Packed',
          'Shipped',
          'Out for Delivery',
          'Delivered',
          'Cancelled',
          'Returned',
          'Refunded'
        ]
      },
      date: {
        type: Date,
        default: Date.now
      },
      note: {
        type: String
      },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  ],
  isPaid: {
    type: Boolean,
    required: true,
    default: false
  },
  paidAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    required: true,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  isRefunded: {
    type: Boolean,
    default: false
  },
  refundedAt: {
    type: Date
  },
  estimatedDeliveryDate: {
    type: Date
  },
  trackingNumber: {
    type: String
  },
  courierProvider: {
    type: String
  },
  // Add detailed tracking information
  tracking: {
    updates: [{
      status: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      location: String,
      description: String
    }],
    estimatedDelivery: {
      type: Date
    },
    lastUpdated: {
      type: Date
    },
    url: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Update inventory on order status changes
orderSchema.pre('save', async function(next) {
  try {
    const Order = this.constructor;
    const Product = mongoose.model('Product');
    const Inventory = mongoose.model('Inventory');
    
    // If this is a new order, decrement inventory
    if (this.isNew && this.status === 'Processing') {
      for (const item of this.items) {
        // Update product stock quantity
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stockQuantity: -item.quantity } }
        );
        
        // Update inventory record if exists
        const inventoryItem = await Inventory.findOne({ product: item.product });
        if (inventoryItem) {
          await Inventory.findByIdAndUpdate(
            inventoryItem._id,
            { $inc: { quantity: -item.quantity } }
          );
        }
      }
    } 
    // If order is being cancelled and was previously Processing or further, restore inventory
    else if (
      this.status === 'Cancelled' && 
      this.statusHistory.length > 0 &&
      ['Processing', 'Packed', 'Shipped', 'Out for Delivery'].includes(this.statusHistory[this.statusHistory.length - 1].status)
    ) {
      for (const item of this.items) {
        // Restore product stock quantity
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stockQuantity: item.quantity } }
        );
        
        // Restore inventory record if exists
        const inventoryItem = await Inventory.findOne({ product: item.product });
        if (inventoryItem) {
          await Inventory.findByIdAndUpdate(
            inventoryItem._id,
            { $inc: { quantity: item.quantity } }
          );
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate orderNumber and handle status history
orderSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      const Order = this.constructor;
      const count = await Order.countDocuments();
      // Generate order number with format: ORD-YYYYMMDD-XXXX
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const sequence = String(count + 1).padStart(4, '0');
      this.orderNumber = `ORD-${year}${month}${day}-${sequence}`;
      
      // Add initial status to history
      this.statusHistory.push({
        status: this.status,
        date: new Date(),
        note: 'Order created',
        updatedBy: this.user
      });
    } else if (this.isModified('status')) {
      // Add status change to history if status was changed
      this.statusHistory.push({
        status: this.status,
        date: new Date(),
        updatedBy: this.modifiedBy || this.user // modifiedBy should be set in the controller
      });
      
      // Update delivery and payment related fields
      if (this.status === 'Delivered' && !this.isDelivered) {
        this.isDelivered = true;
        this.deliveredAt = new Date();
      }
      
      if (this.status === 'Refunded' && !this.isRefunded) {
        this.isRefunded = true;
        this.refundedAt = new Date();
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order; 