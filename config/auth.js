/**
 * Authentication configuration settings
 */
module.exports = {
  // JWT secret key
  jwtSecret: process.env.JWT_SECRET || 'farmmmm_secret_key_12345',
  
  // JWT token expiration
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  
  // JWT refresh token expiration
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '90d',
  
  // Password hashing rounds
  saltRounds: 10
}; 