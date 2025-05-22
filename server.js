const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const logger = require('./utils/logger');
const { connectDB } = require('./config/db');

// Load environment variables - first try config.env
try {
  const configPath = path.join(__dirname, 'config.env');
  dotenv.config({ path: configPath });
  logger.info(`Config loaded from ${configPath}`);
} catch (error) {
  logger.warn('Config file not found, using environment variables');
}

const app = require('./app');

// Force port to be 3001
const PORT = 3001;
console.log("FORCED PORT:", PORT);
let server;

// Start server
const startServer = async () => {
  try {
    // Connect to database (but don't fail if connection fails)
    await connectDB();

    // Start the server
    server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err.message}`);
      logger.error(err.stack);
      
      // Close server & exit process
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught Exception: ${err.message}`);
      logger.error(err.stack);
      
      // Close server & exit process
      if (server) {
        server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });

    // Generate some sample product images on startup to avoid 404 errors
    const fs = require('fs');
    const { generateSampleImages } = require('./controllers/upload.controller');

    // Create sample product images when server starts
    (async () => {
      try {
        console.log('Checking for existing product images...');
        const uploadDir = path.join(__dirname, 'uploads/products');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
          console.log('Created product uploads directory');
        }
        
        // Check if there are any product images
        const files = fs.readdirSync(uploadDir);
        if (files.length === 0) {
          console.log('No product images found, generating sample images...');
          const images = generateSampleImages(5);
          console.log(`Generated ${images.length} sample product images`);
        } else {
          console.log(`Found ${files.length} existing product images`);
        }
      } catch (error) {
        console.error('Error generating sample images on startup:', error);
      }
    })();
  } catch (error) {
    logger.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  }
};

// Handle graceful shutdown
const shutdownGracefully = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close MongoDB connection
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
      
      // Force exit after 3 seconds if connections don't close
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 3000);
    });
  } else {
    process.exit(0);
  }
};

// Process termination handlers
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));

// Initialize server
startServer(); 