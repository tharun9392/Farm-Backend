/**
 * Middleware for role-based authorization
 * @param {Array} roles - Array of allowed roles
 */
const authorize = (roles = []) => {
  // Convert single role to array if not already
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        message: 'Unauthorized - Authentication required'
      });
    }

    // Check if user's role is in the allowed roles list
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Forbidden - You do not have permission to access this resource'
      });
    }

    // User is authorized, proceed to the next middleware
    next();
  };
};

module.exports = {
  authorize
}; 