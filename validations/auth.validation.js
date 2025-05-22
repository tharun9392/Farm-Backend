const Joi = require('joi');

// Registration validation schema
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required()
    .messages({
      'string.base': 'Name should be a string',
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least {#limit} characters long',
      'string.max': 'Name cannot be more than {#limit} characters long',
      'any.required': 'Name is required'
    }),
  
  email: Joi.string().email().required()
    .messages({
      'string.base': 'Email should be a string',
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string().min(6).required()
    .messages({
      'string.base': 'Password should be a string',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least {#limit} characters long',
      'any.required': 'Password is required'
    }),
  
  role: Joi.string().valid('customer', 'farmer', 'staff', 'admin').default('customer')
    .messages({
      'string.base': 'Role should be a string',
      'any.only': 'Role must be one of {#valids}'
    }),
  
  phone: Joi.string().allow(null, ''),
  
  address: Joi.object({
    street: Joi.string().allow(null, ''),
    city: Joi.string().allow(null, ''),
    state: Joi.string().allow(null, ''),
    postalCode: Joi.string().allow(null, ''),
    country: Joi.string().default('India')
  }),
  
  // Farmer-specific fields
  farmDetails: Joi.object({
    farmName: Joi.string().allow(null, ''),
    farmLocation: Joi.string().allow(null, ''),
    farmSize: Joi.number().positive().allow(null),
    farmingExperience: Joi.number().allow(null)
  }).when('role', {
    is: 'farmer',
    then: Joi.object({
      farmName: Joi.string().required(),
      farmLocation: Joi.string().required()
    })
  })
});

// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.base': 'Email should be a string',
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string().required()
    .messages({
      'string.base': 'Password should be a string',
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    })
});

// Password reset request validation schema
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.base': 'Email should be a string',
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
});

// OTP verification validation schema
const verifyOTPSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.base': 'Email should be a string',
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  otp: Joi.string().length(6).pattern(/^[0-9]+$/).required()
    .messages({
      'string.base': 'OTP should be a string',
      'string.empty': 'OTP is required',
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'any.required': 'OTP is required'
    })
});

// Reset password with OTP validation schema
const resetPasswordWithOTPSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.base': 'Email should be a string',
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  otp: Joi.string().length(6).pattern(/^[0-9]+$/).required()
    .messages({
      'string.base': 'OTP should be a string',
      'string.empty': 'OTP is required',
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'any.required': 'OTP is required'
    }),
  password: Joi.string().min(6).required()
    .messages({
      'string.base': 'Password should be a string',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least {#limit} characters long',
      'any.required': 'Password is required'
    }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({
      'string.base': 'Confirm password should be a string',
      'string.empty': 'Confirm password is required',
      'any.only': 'Passwords must match',
      'any.required': 'Confirm password is required'
    })
});

// Password reset validation schema
const resetPasswordSchema = Joi.object({
  token: Joi.string().required()
    .messages({
      'string.base': 'Token should be a string',
      'string.empty': 'Token is required',
      'any.required': 'Token is required'
    }),
  
  password: Joi.string().min(6).required()
    .messages({
      'string.base': 'Password should be a string',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least {#limit} characters long',
      'any.required': 'Password is required'
    })
});

// Refresh token validation schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
    .messages({
      'string.base': 'Refresh token should be a string',
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required'
    })
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyOTPSchema,
  resetPasswordWithOTPSchema
}; 