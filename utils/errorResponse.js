/**
 * Custom error response class to standardize API errors
 * @extends Error
 */
class ErrorResponse extends Error {
  /**
   * Create a new error response
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    
    // Capture the stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorResponse; 