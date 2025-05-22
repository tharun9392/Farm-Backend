const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpire, jwtRefreshExpire } = require('../config/auth');

/**
 * Generate JWT token
 * @param {string} id - User ID
 * @returns {string} - JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, jwtSecret, {
    expiresIn: jwtExpire
  });
};

/**
 * Generate refresh token
 * @param {string} id - User ID
 * @returns {string} - JWT refresh token
 */
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, jwtSecret, {
    expiresIn: jwtRefreshExpire
  });
};

/**
 * Generate auth tokens object
 * @param {string} userId - User ID
 * @returns {Object} - Object containing token and refresh token
 */
const generateAuthTokens = (userId) => {
  return {
    token: generateToken(userId),
    refreshToken: generateRefreshToken(userId)
  };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  generateAuthTokens
}; 