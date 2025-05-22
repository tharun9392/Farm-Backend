const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    riceType: {
      type: String,
      required: [true, 'Rice type is required'],
      enum: ['basmati', 'brown', 'jasmine', 'sona_masoori', 'ponni', 'other']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['basmati', 'brown', 'jasmine', 'sona_masoori', 'ponni', 'other']
    },
    isProcessedRice: {
      type: Boolean,
      default: true,
      description: 'Indicates whether this is processed rice (true) or raw paddy (false)'
    },
    paddySource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      description: 'Reference to the paddy product this rice was processed from (if applicable)'
    },
    paddyToRiceConversion: {
      rate: {
        type: Number,
        min: [0, 'Conversion rate cannot be negative'],
        default: 0.7,
        description: 'Rate of conversion from paddy to rice (e.g., 0.7 means 1kg paddy yields 0.7kg rice)'
      },
      processingCost: {
        type: Number,
        min: [0, 'Processing cost cannot be negative'],
        default: 0,
        description: 'Cost per unit to process paddy to rice'
      }
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
      set: v => v === '' || v === null ? 0 : Number(v)
    },
    farmerPrice: {
      type: Number,
      required: [true, 'Farmer price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0,
      set: v => v === '' || v === null ? 0 : Number(v)
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0,
      set: v => v === '' || v === null ? 0 : Number(v)
    },
    availableQuantity: {
      type: Number,
      required: [true, 'Available quantity is required'],
      min: [0, 'Available quantity cannot be negative'],
      default: 0,
      set: v => v === '' || v === null ? 0 : Number(v)
    },
    unit: {
      type: String,
      enum: ['kg', 'g', 'lb', 'ton'],
      default: 'kg'
    },
    images: [
      {
        type: String
      }
    ],
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Farmer information is required']
    },
    harvestedDate: {
      type: Date
    },
    organicCertified: {
      type: Boolean,
      default: false
    },
    // Quality parameters
    qualityParameters: {
      moisture: {
        type: Number,
        min: 0,
        max: 100,
        set: v => v === '' || v === null ? undefined : Number(v)
      },
      brokenGrains: {
        type: Number,
        min: 0,
        max: 100,
        set: v => v === '' || v === null ? undefined : Number(v)
      },
      foreignMatter: {
        type: Number,
        min: 0,
        max: 100,
        set: v => v === '' || v === null ? undefined : Number(v)
      },
      aroma: {
        type: String,
        enum: ['strong', 'medium', 'mild', 'none']
      },
      color: {
        type: String
      },
      grainLength: {
        type: Number,
        min: 0,
        set: v => v === '' || v === null ? undefined : Number(v)
      }
    },
    // Status of the product (pending approval, approved, rejected)
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    statusReason: {
      type: String
    },
    // Additional information
    region: {
      type: String
    },
    certifications: [
      {
        type: String
      }
    ]
  },
  {
    timestamps: true
  }
);

// Static method to get average rating
productSchema.statics.getAverageRating = async function(productId) {
  const obj = await this.model('Review').aggregate([
    {
      $match: { product: productId }
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' }
      }
    }
  ]);

  try {
    if (obj.length > 0) {
      await this.findByIdAndUpdate(productId, {
        averageRating: obj[0].averageRating
      });
    }
  } catch (err) {
    console.error(err);
  }
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;  