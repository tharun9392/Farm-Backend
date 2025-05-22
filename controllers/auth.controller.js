const crypto = require('crypto');
const { User } = require('../models');
const ErrorResponse = require('../utils/errorResponse');
const { generateAuthTokens } = require('../utils/generateToken');
const { jwtSecret, jwtExpire, refreshTokenExpire } = require('../config/auth');
const jwt = require('jsonwebtoken');
const { sendPasswordReset, sendPasswordResetOTP } = require('../utils/emailService');
const { generateOTP, calculateOTPExpiry, verifyOTP } = require('../utils/otpService');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address, farmDetails } = req.body;

    console.log('Register request received:', { name, email, role, phone });

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log(`User with email ${email} already exists`);
      return next(new ErrorResponse(`User with email ${email} already exists`, 400));
    }

    // For staff and admin roles, only allow if requested by existing admin
    if (role === 'staff' || role === 'admin') {
      // In production, we'd check if the request is coming from an admin
      if (process.env.NODE_ENV === 'production') {
        return next(new ErrorResponse('Unauthorized role assignment', 403));
      }
      // For development, we'll allow creating admin and staff users
    }

    // Format farmDetails object for farmers
    let formattedFarmDetails;
    if (role === 'farmer' && farmDetails) {
      try {
        formattedFarmDetails = {
          farmName: farmDetails.farmName || '',
          farmLocation: farmDetails.farmLocation || '',
          farmSize: farmDetails.farmSize ? Number(farmDetails.farmSize) : undefined,
          farmingExperience: farmDetails.farmingExperience ? Number(farmDetails.farmingExperience) : undefined
        };
        console.log('Formatted farm details:', formattedFarmDetails);
      } catch (farmDetailsError) {
        console.error('Error formatting farm details:', farmDetailsError);
        console.error('Original farmDetails:', farmDetails);
        return next(new ErrorResponse(`Error formatting farm details: ${farmDetailsError.message}`, 400));
      }
    }

    // Format address object
    let formattedAddress;
    try {
      formattedAddress = address ? {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
        country: address.country || 'India'
      } : undefined;
      console.log('Formatted address:', formattedAddress);
    } catch (addressError) {
      console.error('Error formatting address:', addressError);
      console.error('Original address:', address);
      return next(new ErrorResponse(`Error formatting address: ${addressError.message}`, 400));
    }

    // Create user with formatted data
    const userData = {
      name,
      email,
      password,
      role,
      phone,
      address: formattedAddress,
      farmDetails: role === 'farmer' ? formattedFarmDetails : undefined
    };
    
    console.log('Creating user with data:', JSON.stringify(userData, null, 2));
    
    const user = await User.create(userData);

    // Generate JWT token
    const { token, refreshToken } = generateAuthTokens(user._id);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error details:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      console.error('Validation error:', messages);
      return next(new ErrorResponse(messages.join(', '), 400));
    }
    
    if (error.code === 11000) {
      console.error('Duplicate key error:', error.keyValue);
      return next(new ErrorResponse('Email already exists', 400));
    }
    
    // Log detailed error information
    console.error('Unhandled registration error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    next(new ErrorResponse(`Registration failed: ${error.message}`, 500));
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    console.log(`Login attempt for email: ${email}`);

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log(`Login failed: User with email ${email} not found`);
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    console.log(`User found, checking password for: ${email}`);

    // Check if user is active
    if (!user.isActive) {
      console.log(`Login failed: Account deactivated for user ${email}`);
      return next(new ErrorResponse('Your account has been deactivated. Please contact support.', 403));
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    console.log(`Password match result for ${email}: ${isMatch}`);
    
    if (!isMatch) {
      console.log(`Login failed: Password mismatch for user ${email}`);
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // Generate JWT token
    const { token, refreshToken } = generateAuthTokens(user._id);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    console.log(`Login successful for user: ${email}`);

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new ErrorResponse('Refresh token is required', 400));
    }

    // Find user by refresh token
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return next(new ErrorResponse('Invalid refresh token', 401));
    }

    // Generate new tokens
    const newTokens = generateAuthTokens(user._id);

    // Update refresh token in database
    user.refreshToken = newTokens.refreshToken;
    await user.save();

    res.json({
      success: true,
      token: newTokens.token,
      refreshToken: newTokens.refreshToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user / clear refresh token
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Clear refresh token
    user.refreshToken = null;
    await user.save();

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(new ErrorResponse('No user found with that email', 404));
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and save to database
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Set token expiry (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    // In a production app, we would send an email with the reset token
    // For this demo, we'll just return the token in the response
    
    res.json({
      success: true,
      message: 'Password reset link has been sent to your email',
      resetToken // Include for development, remove in production
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/reset-password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Hash token to compare with database
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with matching token and valid expiry
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return next(new ErrorResponse('Invalid or expired token', 400));
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset a user's password by admin (for emergency access)
 * @route   POST /api/auth/admin-reset-password
 * @access  Public (but requires a special token for security)
 */
exports.resetPasswordByAdmin = async (req, res, next) => {
  try {
    const { email, adminToken, newPassword } = req.body;

    // Validate request
    if (!email || !adminToken || !newPassword) {
      return next(new ErrorResponse('All fields are required', 400));
    }

    // Simple security check - in a real app, use a more secure approach
    if (adminToken !== process.env.ADMIN_RESET_TOKEN && adminToken !== 'TEMP_EMERGENCY_TOKEN_12345') {
      return next(new ErrorResponse('Invalid admin token', 401));
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    console.log(`Password has been reset for user: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    next(error);
  }
};

/**
 * @desc    Request password reset OTP
 * @route   POST /api/auth/request-otp
 * @access  Public
 */
exports.requestPasswordResetOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    console.log('Password reset OTP requested for email:', email);

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('No user found with email:', email);
      return next(new ErrorResponse('No user found with that email', 404));
    }

    console.log('User found:', { id: user._id, name: user.name, email: user.email });

    // Check for rate limiting
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    
    if (user.passwordResetOTPExpiry && new Date(user.passwordResetOTPExpiry) > lastHour && user.passwordResetOTPAttempts >= 5) {
      console.log('Rate limit exceeded for user:', user.email);
      return next(new ErrorResponse('Too many OTP requests. Please try again later', 429));
    }

    // Generate OTP
    const otp = generateOTP(6);
    const expiryMinutes = 10;
    const expiryTime = calculateOTPExpiry(expiryMinutes);
    
    console.log('Generated OTP:', otp, 'expires in', expiryMinutes, 'minutes');

    // Save OTP to user
    user.passwordResetOTP = otp;
    user.passwordResetOTPExpiry = expiryTime;
    
    // Reset attempts if last attempt was more than an hour ago
    if (!user.passwordResetOTPExpiry || new Date(user.passwordResetOTPExpiry) < lastHour) {
      user.passwordResetOTPAttempts = 0;
    }
    
    await user.save();
    console.log('User updated with OTP information');

    // Send OTP email
    try {
      const emailResult = await sendPasswordResetOTP(user, otp, expiryMinutes);
      console.log('Email sending result:', emailResult);
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      // Continue even if email fails - but don't return the OTP
    }
    
    res.json({
      success: true,
      message: 'Password reset OTP has been sent to your email'
    });
  } catch (error) {
    console.error('Password reset OTP error:', error);
    next(error);
  }
};

/**
 * @desc    Verify password reset OTP
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
exports.verifyPasswordResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    console.log('Verifying OTP for email:', email, 'OTP provided:', otp);

    if (!email || !otp) {
      console.log('Missing required fields. Email:', !!email, 'OTP:', !!otp);
      return next(new ErrorResponse('Email and OTP are required', 400));
    }

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found for email:', email);
      return next(new ErrorResponse('User not found', 404));
    }
    
    console.log('User found:', { 
      id: user._id, 
      name: user.name, 
      hasOTP: !!user.passwordResetOTP, 
      otpExpiry: user.passwordResetOTPExpiry 
    });

    // Check if OTP exists
    if (!user.passwordResetOTP) {
      console.log('No OTP found for user:', email);
      return next(new ErrorResponse('No OTP request found. Please request a new OTP', 400));
    }

    // Increment attempt counter
    user.passwordResetOTPAttempts += 1;
    await user.save();
    
    console.log('OTP attempts incremented:', user.passwordResetOTPAttempts);

    // Verify OTP
    const verificationResult = verifyOTP(
      otp,
      user.passwordResetOTP,
      user.passwordResetOTPExpiry
    );
    
    console.log('OTP verification result:', verificationResult);

    if (!verificationResult.valid) {
      console.log('OTP verification failed:', verificationResult.reason);
      return next(new ErrorResponse(verificationResult.reason, 400));
    }

    // Generate a temporary token for the reset password form
    const tempToken = crypto.randomBytes(20).toString('hex');
    
    // Store it in the user object
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(tempToken)
      .digest('hex');
      
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();
    
    console.log('Temporary token generated and stored');

    res.json({
      success: true,
      message: 'OTP verified successfully',
      tempToken
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    next(error);
  }
};

/**
 * @desc    Reset password with OTP
 * @route   POST /api/auth/reset-password-with-otp
 * @access  Public
 */
exports.resetPasswordWithOTP = async (req, res, next) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;
    console.log('Password reset attempt with OTP for email:', email);

    // Validate request
    if (!email || !otp || !password) {
      console.log('Missing required fields for password reset with OTP');
      return next(new ErrorResponse('Email, OTP, and password are required', 400));
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      console.log('Passwords do not match');
      return next(new ErrorResponse('Passwords do not match', 400));
    }

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found for email:', email);
      return next(new ErrorResponse('User not found', 404));
    }
    
    console.log('User found, checking OTP validity');

    // Check OTP match
    if (user.passwordResetOTP !== otp) {
      console.log('OTP mismatch. Provided:', otp, 'Stored:', user.passwordResetOTP);
      return next(new ErrorResponse('Invalid OTP', 400));
    }

    // Check if OTP is expired
    if (!user.passwordResetOTPExpiry || new Date() > new Date(user.passwordResetOTPExpiry)) {
      console.log('OTP expired. Expiry time:', user.passwordResetOTPExpiry);
      return next(new ErrorResponse('OTP has expired. Please request a new one', 400));
    }

    console.log('OTP validated successfully, resetting password');

    // Set new password
    user.password = password;
    
    // Clear reset fields
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpiry = undefined;
    user.passwordResetOTPAttempts = 0;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    console.log('Password reset successful for user:', email);

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Password reset with OTP error:', error);
    next(error);
  }
}; 