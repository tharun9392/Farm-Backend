/**
 * Database configuration and connection handler
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB database
 * @returns {Promise<mongoose.Connection>} Mongoose connection
 */
const connectDB = async () => {
  try {
    // Check for MongoDB connection string
    if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
      process.env.MONGO_URI = process.env.MONGODB_URI;
      logger.info('Using MONGODB_URI instead of MONGO_URI');
    }

    // If no MongoDB URI is provided, log a warning and return null
    if (!process.env.MONGO_URI) {
      logger.warn('MongoDB URI not found. Server will start without database connection.');
      return null;
    }

    // Configure mongoose connection options
    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: process.env.NODE_ENV !== 'production'
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Add connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    logger.warn('Server will start without database connection.');
    return null;
  }
};

module.exports = { connectDB }; 