const ErrorResponse = require('../utils/errorResponse');

/**
 * Global error handler
 * @param {Object} err - Error object
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for server-side debugging
  console.error(`ERROR [${req.method}] ${req.path}: `, {
    error: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user ? req.user._id : 'Unauthenticated'
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value entered: ${field}. Please use another value.`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ErrorResponse(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ErrorResponse('Invalid token. Please log in again.', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new ErrorResponse('Token expired. Please log in again.', 401);
  }

  // File upload error
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ErrorResponse('File size too large. Maximum size is 2MB.', 400);
  }

  // Default response
  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    message: error.message || 'Server Error',
    error: {
      code: statusCode,
      message: error.message || 'Server Error'
    }
  };

  // Include stack trace in development environment
  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    response.error.stack = err.stack;
  }

  // Include validation errors if present
  if (err.errors) {
    response.error.validation = err.errors;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  errorHandler,
  ErrorResponse
}; 