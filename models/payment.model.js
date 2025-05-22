const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    // This can be either a farmer payment or a customer payment
    paymentType: {
      type: String,
      required: true,
      enum: ['farmer-payment', 'customer-payment', 'refund']
    },
    // Reference to the user who received/made the payment
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    // For customer payments only - reference to order
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    // For farmer payments only - reference to inventory
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory'
    },
    // Payment gateway transaction info
    transactionId: {
      type: String
    },
    paymentGateway: {
      type: String,
      enum: ['Stripe', 'Razorpay', 'PayPal', 'Bank Transfer', 'Cash', 'Other']
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR'
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'pending'
    },
    paymentMethod: {
      type: String
    },
    description: {
      type: String
    },
    paymentDate: {
      type: Date
    },
    notes: {
      type: String
    },
    // Invoice information
    invoice: {
      invoiceNumber: { type: String },
      invoiceDate: { type: Date },
      dueDate: { type: Date },
      items: [{
        name: { type: String },
        description: { type: String },
        quantity: { type: Number },
        unitPrice: { type: Number },
        totalPrice: { type: Number },
        taxRate: { type: Number },
        taxAmount: { type: Number }
      }],
      subtotal: { type: Number },
      taxTotal: { type: Number },
      discount: { type: Number },
      total: { type: Number },
      paidAmount: { type: Number },
      balanceDue: { type: Number },
      notes: { type: String },
      terms: { type: String },
      status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
      },
      pdfUrl: { type: String }
    },
    // For refunds
    refundDetails: {
      refundDate: { type: Date },
      refundAmount: { type: Number },
      refundReason: { type: String },
      refundedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      refundTransactionId: { type: String },
      refundStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
      },
      processingFee: { type: Number, default: 0 },
      refundMethod: { type: String }
    },
    // For farmer payments specifically
    farmerPaymentDetails: {
      riceQuantity: { type: Number }, // kg of rice purchased
      ratePerKg: { type: Number },
      paymentMethod: { type: String },
      bankDetails: {
        accountNumber: { type: String },
        accountName: { type: String },
        bankName: { type: String },
        ifscCode: { type: String }
      }
    },
    // Payment analytics tracking
    analytics: {
      ipAddress: { type: String },
      device: { type: String },
      location: { type: String },
      processingTime: { type: Number }, // in milliseconds
      attemptCount: { type: Number, default: 1 },
      conversionPath: { type: String }, // e.g., "product_page > cart > checkout"
      lastAttemptDate: { type: Date }
    },
    // For GST/tax compliance
    taxDetails: {
      gstin: { type: String }, // GST Identification Number
      hsnCode: { type: String }, // Harmonized System Nomenclature code
      cgst: { type: Number, default: 0 }, // Central GST
      sgst: { type: Number, default: 0 }, // State GST
      igst: { type: Number, default: 0 }, // Integrated GST
      taxInvoiceNumber: { type: String }
    }
  },
  {
    timestamps: true
  }
);

// Create indexes for faster queries
paymentSchema.index({ user: 1 });
paymentSchema.index({ order: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentDate: 1 });
paymentSchema.index({ 'invoice.invoiceNumber': 1 });
paymentSchema.index({ transactionId: 1 });

// Middleware to update related entities when payment status changes
paymentSchema.pre('save', async function(next) {
  try {
    // If payment status is changing to completed
    if (this.isModified('status') && this.status === 'completed') {
      if (this.paymentType === 'customer-payment' && this.order) {
        // Update the order when payment is completed
        const Order = mongoose.model('Order');
        await Order.findByIdAndUpdate(this.order, {
          isPaid: true,
          paidAt: new Date(),
          'paymentResult.status': 'completed',
          'paymentResult.updateTime': new Date()
        });
      }

      // Record payment date
      this.paymentDate = new Date();
    }

    // If payment is being refunded
    if (this.isModified('status') && this.status === 'refunded') {
      if (this.paymentType === 'customer-payment' && this.order) {
        // Update the order when payment is refunded
        const Order = mongoose.model('Order');
        await Order.findByIdAndUpdate(this.order, {
          isRefunded: true,
          refundedAt: new Date(),
          status: 'Refunded'
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment; 