/**
 * OTP Service for generating and verifying OTPs
 */
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Generate a random OTP of specified length
 * @param {Number} length - Length of OTP (default: 6)
 * @returns {String} - Generated OTP
 */
const generateOTP = (length = 6) => {
  // Generate a random number with the specified number of digits
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  
  // Use crypto for better randomness when available, fallback to Math.random
  let otp;
  try {
    // Generate a cryptographically strong random number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = parseInt(randomBytes.toString('hex'), 16);
    
    // Scale to the desired range
    otp = (randomNumber % (max - min + 1)) + min;
  } catch (error) {
    logger.warn('Crypto random generation failed, falling back to Math.random');
    otp = Math.floor(Math.random() * (max - min + 1) + min);
  }
  
  return otp.toString().padStart(length, '0');
};

/**
 * Calculate OTP expiry time
 * @param {Number} minutes - Minutes until expiry (default: 10)
 * @returns {Date} - Expiry timestamp
 */
const calculateOTPExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

/**
 * Verify if OTP is valid and not expired
 * @param {String} inputOTP - OTP provided by user
 * @param {String} storedOTP - OTP stored in database
 * @param {Date} expiryTime - OTP expiry timestamp
 * @returns {Boolean} - Whether OTP is valid
 */
const verifyOTP = (inputOTP, storedOTP, expiryTime) => {
  // Check if expired
  if (!expiryTime || new Date() > new Date(expiryTime)) {
    logger.info('OTP verification failed: Expired');
    return false;
  }
  
  // Check if OTP matches
  if (!inputOTP || !storedOTP || inputOTP !== storedOTP) {
    logger.info('OTP verification failed: Mismatch');
    return false;
  }
  
  logger.info('OTP verification successful');
  return true;
};

module.exports = {
  generateOTP,
  calculateOTPExpiry,
  verifyOTP
}; 