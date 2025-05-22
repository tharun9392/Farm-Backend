const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validation.middleware');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyOTPSchema,
  resetPasswordWithOTPSchema
} = require('../validations/auth.validation');

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);

// Password reset routes
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.put('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/admin-reset-password', authController.resetPasswordByAdmin);

// OTP-based password reset routes
router.post('/request-otp', validate(forgotPasswordSchema), authController.requestPasswordResetOTP);
router.post('/verify-otp', validate(verifyOTPSchema), authController.verifyPasswordResetOTP);
router.post('/reset-password-with-otp', validate(resetPasswordWithOTPSchema), authController.resetPasswordWithOTP);

// Protected routes
router.get('/me', protect, authController.getCurrentUser);
router.post('/logout', protect, authController.logout);

// DEVELOPMENT ONLY - Special route to activate a user account
// WARNING: This should be disabled in production
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-activate-user', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false, 
          message: 'Email is required'
        });
      }
      
      const { User } = require('../models');
      const user = await User.findOne({ email });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User with email ${email} not found`
        });
      }
      
      // Activate the user account
      user.isActive = true;
      await user.save();
      
      res.status(200).json({
        success: true,
        message: `User ${email} has been activated`,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }
      });
    } catch (error) {
      console.error('Error activating user:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while activating user',
        error: error.message
      });
    }
  });
}

module.exports = router; 