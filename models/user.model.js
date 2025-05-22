const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { saltRounds } = require('../config/auth');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Don't include password in query results by default
    },
    role: {
      type: String,
      enum: ['customer', 'farmer', 'staff', 'admin'],
      default: 'customer'
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String, default: 'India' }
    },
    profileImage: {
      type: String,
      default: 'default-profile.jpg'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'blocked'],
      default: 'active'
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    // Farmer-specific fields
    farmDetails: {
      farmName: { type: String },
      farmLocation: { type: String },
      farmSize: { type: Number }, // in acres
      farmingExperience: { type: Number } // in years
    },
    // For password reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // For OTP-based password reset
    passwordResetOTP: String,
    passwordResetOTPExpiry: Date,
    passwordResetOTPAttempts: {
      type: Number,
      default: 0
    },
    // For refreshing JWT tokens
    refreshToken: String
  },
  {
    timestamps: true
  }
);

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it was modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Generate salt
    const salt = await bcrypt.genSalt(saltRounds);
    // Hash the password with the salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Return user's full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

const User = mongoose.model('User', userSchema);

module.exports = User; 