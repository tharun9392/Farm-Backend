const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { jwtSecret } = require('../config/auth');

/**
 * Middleware to protect routes
 * Verifies JWT token and attaches user to request
 */
const protect = async (req, res, next) => {
  let token;

  // Added detailed debugging
  console.log('Auth Middleware Debug:', {
    url: req.originalUrl,
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
    authHeader: req.headers.authorization ? `${req.headers.authorization.substring(0, 15)}...` : 'None'
  });

  // Check if token exists in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      console.log('JWT Token Debug:', {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        tokenPrefix: token ? `${token.substring(0, 10)}...` : 'None'
      });

      // Verify token
      const decoded = jwt.verify(token, jwtSecret);
      
      console.log('JWT Decoded Debug:', {
        decoded: {
          id: decoded.id,
          iat: decoded.iat,
          exp: decoded.exp
        }
      });

      // Get user from the token
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        console.error('User not found despite valid token for ID:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'User not found. Please login again.'
        });
      }
      
      console.log('User Debug:', {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        status: user.status || 'not set'
      });
      
      // In development mode, always allow access regardless of account status
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: Bypassing account status check for user:', user.email);
        req.user = user;
        next();
        return;
      }
      
      // Check if user is active - Check both fields for backwards compatibility
      if (!user.isActive || (user.status && user.status !== 'active')) {
        console.error('User account is not active:', {
          isActive: user.isActive,
          status: user.status || 'not set'
        });
        return res.status(403).json({
          success: false,
          message: 'Your account is not active. Please contact an administrator.'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.'
        });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please login again.'
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed. Please login again.'
        });
      }
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided'
    });
  }
};

/**
 * Middleware for role authorization
 * @param  {...String} roles - allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no user found'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    
    next();
  };
};

/**
 * Check if user is account owner or admin
 * Used for updating user profiles
 */
const isOwnerOrAdmin = (req, res, next) => {
  const userId = req.params.id;
  const authUserId = req.user.id;
  const userRole = req.user.role;
  
  // Allow if user is owner of the account or is an admin
  if (userId === authUserId || userRole === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Not authorized to access this resource'
    });
  }
};

/**
 * Check if user is a farmer
 * For farmer-specific routes
 */
const isFarmer = (req, res, next) => {
  if (req.user.role !== 'farmer') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to farmers only'
    });
  }
  next();
};

/**
 * Check if user is an admin
 * For admin-specific routes
 */
const isAdmin = (req, res, next) => {
  console.log('Admin authorization check:', {
    user: req.user ? {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    } : 'No user found in request'
  });
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to admin only'
    });
  }
  next();
};

/**
 * Check if user is staff or admin
 * For staff and admin routes
 */
const isStaffOrAdmin = (req, res, next) => {
  console.log('Staff/Admin authorization check:', {
    url: req.originalUrl,
    method: req.method,
    user: req.user ? {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    } : 'No user found in request'
  });
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.'
    });
  }
  
  if (req.user.role !== 'staff' && req.user.role !== 'admin') {
    console.log('Access denied: User role is', req.user.role);
    return res.status(403).json({
      success: false,
      message: 'Access restricted to staff and admin only'
    });
  }
  next();
};

/**
 * Middleware to authenticate JWT tokens and protect routes
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required. Please login.'
      });
    }

    // Extract token from header
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'Authentication token is missing'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid authentication token'
      });
    }

    // Add user to request for use in protected routes
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid authentication token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Authentication token expired'
      });
    }
    
    res.status(500).json({
      message: 'Authentication failed. Please try again.'
    });
  }
};

module.exports = {
  protect,
  authorize,
  isOwnerOrAdmin,
  isFarmer,
  isAdmin,
  isStaffOrAdmin,
  authenticate
}; 