const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.1, 'Quantity must be at least 0.1']
    },
    unit: {
      type: String,
      enum: ['kg', 'g', 'lb', 'ton'],
      default: 'kg',
      required: true
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative']
    },
    buyer: {
      type: String,
      required: true,
      trim: true
    },
    buyerType: {
      type: String,
      enum: ['central_inventory', 'direct_customer', 'wholesale', 'other'],
      default: 'central_inventory'
    },
    transactionId: {
      type: String,
      unique: true,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'credit', 'other'],
      default: 'bank_transfer'
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to generate transaction ID
saleSchema.pre('save', function(next) {
  if (!this.transactionId || this.isNew) {
    // Generate a unique transaction ID: TRX-YYYYMMDD-XXXX (random 4 digit)
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    this.transactionId = `TRX-${formattedDate}-${random}`;
  }
  next();
});

// Create index for faster queries
saleSchema.index({ farmer: 1, createdAt: -1 });
saleSchema.index({ product: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ paymentStatus: 1 });

const Sale = mongoose.model('Sale', saleSchema);

module.exports = Sale; 