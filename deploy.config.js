/**
 * Deployment configuration for Farmer Rice application
 * This file contains settings for different deployment environments
 */

module.exports = {
  // Production environment settings
  production: {
    NODE_ENV: 'production',
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRE: '30d',
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    EMAIL_FROM: process.env.EMAIL_FROM || 'no-reply@farmerrice.com',
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://farmer-rice.netlify.app'
  },
  
  // Staging environment settings
  staging: {
    NODE_ENV: 'staging',
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.MONGO_URI_STAGING,
    JWT_SECRET: process.env.JWT_SECRET_STAGING,
    JWT_EXPIRE: '30d',
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY_STAGING,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID_STAGING,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET_STAGING,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME_STAGING,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY_STAGING,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET_STAGING,
    EMAIL_FROM: process.env.EMAIL_FROM_STAGING || 'staging-no-reply@farmerrice.com',
    FRONTEND_URL: process.env.FRONTEND_URL_STAGING || 'https://staging.farmer-rice.netlify.app'
  }
}; 