const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required']
    },
    // Original farmer who supplied this rice
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Farmer reference is required']
    },
    // Purchase details from farmer
    purchaseDetails: {
      purchaseDate: {
        type: Date,
        default: Date.now
      },
      quantityPurchased: {
        type: Number,
        required: [true, 'Purchase quantity is required'],
        min: [0, 'Quantity cannot be negative']
      },
      purchasePrice: {
        type: Number,
        required: [true, 'Purchase price is required'],
        min: [0, 'Price cannot be negative']
      },
      totalPurchaseAmount: {
        type: Number,
        required: [true, 'Total purchase amount is required']
      }
    },
    // Current details for selling to customers
    currentStock: {
      type: Number,
      required: [true, 'Current stock is required'],
      min: [0, 'Stock cannot be negative']
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Price cannot be negative']
    },
    // Packaging info
    packaging: {
      sizes: [
        {
          weight: { type: Number }, // in kg
          price: { type: Number },
          available: { type: Boolean, default: true }
        }
      ],
      defaultSize: {
        type: Number,
        default: 1 // Default packaging size in kg
      }
    },
    // Quality verification after admin's check
    qualityVerification: {
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verificationDate: {
        type: Date
      },
      qualityGrade: {
        type: String,
        enum: ['A+', 'A', 'B+', 'B', 'C', 'D']
      },
      notes: {
        type: String
      }
    },
    // Location in warehouse
    warehouseLocation: {
      section: { type: String },
      rack: { type: String },
      bin: { type: String }
    },
    lowStockThreshold: {
      type: Number,
      default: 50
    },
    isLowStock: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['available', 'low-stock', 'out-of-stock', 'discontinued'],
      default: 'available'
    },
    // Inventory movement tracking
    stockMovement: [
      {
        date: { type: Date, default: Date.now },
        quantity: { type: Number, required: true }, // Positive for additions, negative for reductions
        type: { 
          type: String, 
          enum: ['purchase', 'sale', 'adjustment', 'return', 'loss'], 
          required: true 
        },
        reference: {
          model: { type: String, enum: ['Order', 'Sale', 'Adjustment'] },
          id: { type: mongoose.Schema.Types.ObjectId },
        },
        notes: { type: String },
        performedBy: { 
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      }
    ],
    // For forecasting
    salesHistory: [
      {
        period: { type: String, required: true }, // Format: YYYY-MM
        quantitySold: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 }
      }
    ],
    forecast: {
      predictedDemand: { type: Number, default: 0 },
      confidenceLevel: { type: Number, min: 0, max: 100, default: 0 },
      recommendedReorderQuantity: { type: Number, default: 0 },
      reorderPoint: { type: Number, default: 0 },
      lastUpdated: { type: Date }
    },
    // Quality assessment details
    qualityAssessment: [
      {
        assessmentDate: { type: Date, default: Date.now },
        assessedBy: { 
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        moistureContent: { type: Number }, // Percentage
        broken: { type: Number }, // Percentage
        foreignMatter: { type: Number }, // Percentage
        discoloration: { type: Number }, // Percentage
        aroma: { 
          type: String,
          enum: ['excellent', 'good', 'average', 'poor', 'bad']
        },
        overallGrade: { 
          type: String,
          enum: ['A+', 'A', 'B+', 'B', 'C', 'D']
        },
        notes: { type: String }
      }
    ],
    notificationSettings: {
      lowStockAlert: { type: Boolean, default: true },
      priceChangeAlert: { type: Boolean, default: true },
      qualityIssueAlert: { type: Boolean, default: true }
    }
  },
  {
    timestamps: true
  }
);

// Set isLowStock flag automatically
inventorySchema.pre('save', function(next) {
  if (this.currentStock <= this.lowStockThreshold) {
    this.isLowStock = true;
    this.status = this.currentStock === 0 ? 'out-of-stock' : 'low-stock';
  } else {
    this.isLowStock = false;
    this.status = 'available';
  }
  next();
});

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory; 