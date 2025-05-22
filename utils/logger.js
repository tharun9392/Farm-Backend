const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log formats
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Configure logger based on environment
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: fileFormat,
  defaultMeta: { service: 'farmer-rice-api' },
  transports: [
    // Write all logs error level and below to error.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Utility function to log API requests
logger.logApiRequest = (req, res, next) => {
  const startTime = new Date();
  
  // Log when the request is complete
  res.on('finish', () => {
    const duration = new Date() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger.log({
      level: logLevel,
      message: `${req.method} ${req.originalUrl}`,
      meta: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        statusCode: res.statusCode,
        responseTime: `${duration}ms`,
        user: req.user ? req.user._id : 'Unauthenticated'
      }
    });
  });
  
  next();
};

// Extending console.error and console.log to use our logger
if (process.env.NODE_ENV === 'production') {
  // Override console.log and console.error in production
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  console.log = (...args) => {
    logger.info(args.join(' '));
    originalConsoleLog.apply(console, args);
  };
  
  console.error = (...args) => {
    logger.error(args.join(' '));
    originalConsoleError.apply(console, args);
  };
}

module.exports = logger; 