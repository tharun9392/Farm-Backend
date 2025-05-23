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

// Use environment PORT or fallback to 5015 (Render.com default)
const PORT = parseInt(process.env.PORT || '5015', 10);
console.log("Server will listen on PORT:", PORT);
let server;

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Create HTTP server
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info(`Server is bound to all network interfaces (0.0.0.0)`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err.message}`);
      logger.error(err.stack);
      shutdownGracefully('UNHANDLED_REJECTION');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught Exception: ${err.message}`);
      logger.error(err.stack);
      shutdownGracefully('UNCAUGHT_EXCEPTION');
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
          const images = await generateSampleImages(5);
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
    try {
      // Close HTTP server first
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed');

      // Then close MongoDB connection
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
      }

      process.exit(0);
    } catch (error) {
      logger.error(`Error during graceful shutdown: ${error.message}`);
      process.exit(1);
    }
  } else {
    process.exit(0);
  }
};

// Process termination handlers
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));

// Initialize server
startServer(); 