const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required']
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required']
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5']
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters']
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      maxlength: [500, 'Comment cannot be more than 500 characters']
    },
    images: [
      {
        type: String
      }
    ],
    isVerifiedPurchase: {
      type: Boolean,
      default: false
    },
    // Admin can hide inappropriate reviews
    isVisible: {
      type: Boolean,
      default: true
    },
    // Helpfulness - how many users found this review helpful
    helpfulCount: {
      type: Number,
      default: 0
    },
    // Users who found this review helpful
    helpfulUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Prevent user from submitting more than one review per product
reviewSchema.index(
  { product: 1, customer: 1 },
  { unique: true, name: 'one_review_per_product_per_customer' }
);

// Update product's average rating after save
reviewSchema.post('save', async function() {
  await this.constructor.model('Product').getAverageRating(this.product);
});

// Update product's average rating after removal
reviewSchema.post('remove', async function() {
  await this.constructor.model('Product').getAverageRating(this.product);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review; 