/**
 * Async handler to wrap async express route handlers and middleware
 * This eliminates the need for try-catch blocks in controllers
 * @param {Function} fn - Express route handler or middleware function
 * @returns {Function} - Express middleware function with error handling
 */
const asyncHandler = (fn) => (req, res, next) => 
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler; 