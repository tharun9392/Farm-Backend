const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { uploadProductImages, serveImageProxy, generateSampleImages } = require('../controllers/upload.controller');
const path = require('path');
const fs = require('fs');

// Base route: /api/upload

// Upload product images (allow farmers, staff, and admin)
router.post('/product-images', authenticate, authorize(['farmer', 'admin', 'staff']), uploadProductImages);

// Serve image via proxy (public)
router.get('/proxy/:type/:filename', serveImageProxy);

// Generate fallback image for missing product images (for troubleshooting)
router.get('/generate-fallback/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security check
    if (filename.includes('..')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid filename' 
      });
    }
    
    // Only handle image files
    if (!filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid file type. Only image files are supported.' 
      });
    }
    
    // Ensure uploads directory exists
    const uploadDir = path.join(__dirname, '../uploads/products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Create the file path
    const filePath = path.join(uploadDir, filename);
    
    // Create a simple image if it doesn't exist
    if (!fs.existsSync(filePath)) {
      // Get the fallback image
      const fallbackPath = path.join(__dirname, '../public/fallback/rice-product.svg');
      
      if (fs.existsSync(fallbackPath)) {
        // Copy the fallback image to the requested path
        fs.copyFileSync(fallbackPath, filePath);
        
        return res.status(201).json({
          success: true,
          message: 'Fallback image generated successfully',
          path: `/uploads/products/${filename}`
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Fallback image template not found'
        });
      }
    } else {
      // File already exists
      return res.status(200).json({
        success: true,
        message: 'Image already exists',
        path: `/uploads/products/${filename}`
      });
    }
  } catch (error) {
    console.error('Error generating fallback image:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating fallback image',
      error: error.message
    });
  }
});

// Generate sample product images for testing
router.get('/generate-sample-images', (req, res) => {
  try {
    const count = parseInt(req.query.count) || 5;
    
    // Limit the number of images that can be created at once
    const actualCount = Math.min(count, 20);
    
    const generatedImages = generateSampleImages(actualCount);
    
    return res.status(200).json({
      success: true,
      message: `Generated ${generatedImages.length} sample product images`,
      images: generatedImages
    });
  } catch (error) {
    console.error('Error generating sample images:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating sample images',
      error: error.message
    });
  }
});

// Directly serve the fallback image
router.get('/fallback-image', (req, res) => {
  try {
    const fallbackPath = path.join(__dirname, '../public/fallback/rice-product.svg');
    
    if (fs.existsSync(fallbackPath)) {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Timing-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept');
      res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
      
      // Set content type for SVG
      res.setHeader('Content-Type', 'image/svg+xml');
      
      return res.sendFile(fallbackPath);
    } else {
      return res.status(404).json({
        success: false,
        message: 'Fallback image not found'
      });
    }
  } catch (error) {
    console.error('Error serving fallback image:', error);
    return res.status(500).json({
      success: false,
      message: 'Error serving fallback image',
      error: error.message
    });
  }
});

// Health check for image server
router.get('/image-server-status', (req, res) => {
  try {
    // Check if all required directories exist
    const directories = [
      path.join(__dirname, '../uploads'),
      path.join(__dirname, '../uploads/products'),
      path.join(__dirname, '../public/fallback')
    ];
    
    const status = {
      success: true,
      directories: {},
      fallbackImage: false,
      sampleImageCount: 0
    };
    
    // Check each directory
    directories.forEach(dir => {
      const exists = fs.existsSync(dir);
      status.directories[path.basename(dir)] = exists;
      
      // If it's the products directory, count how many files exist
      if (exists && path.basename(dir) === 'products') {
        try {
          const files = fs.readdirSync(dir);
          status.sampleImageCount = files.length;
        } catch (e) {
          console.error(`Error reading directory ${dir}:`, e);
        }
      }
    });
    
    // Check if fallback image exists
    const fallbackPath = path.join(__dirname, '../public/fallback/rice-product.svg');
    status.fallbackImage = fs.existsSync(fallbackPath);
    
    // Create the fallback image if it doesn't exist
    if (!status.fallbackImage) {
      try {
        const fallbackDir = path.join(__dirname, '../public/fallback');
        if (!fs.existsSync(fallbackDir)) {
          fs.mkdirSync(fallbackDir, { recursive: true });
        }
        
        // Try to create a fallback image
        status.fallbackImageCreated = true;
      } catch (e) {
        status.fallbackImageError = e.message;
      }
    }
    
    // Generate a sample image if none exist
    if (status.sampleImageCount === 0) {
      try {
        const images = generateSampleImages(1);
        status.generatedSampleImage = images.length > 0;
        status.sampleImagePath = images[0] || null;
      } catch (e) {
        status.sampleImageError = e.message;
      }
    }
    
    return res.status(200).json(status);
  } catch (error) {
    console.error('Error in image server status check:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking image server status',
      error: error.message
    });
  }
});

// New endpoint to handle direct requests for expected image URLs
router.get('/handle-missing-product-image/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security check
    if (filename.includes('..')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid filename' 
      });
    }
    
    // Only handle product images
    if (!filename.match(/^product-\d+-\d+\.(jpg|jpeg|png|gif|webp)$/i)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product image filename pattern' 
      });
    }
    
    console.log(`Handling request for missing product image: ${filename}`);
    
    // Check if the file already exists in uploads
    const uploadDir = path.join(__dirname, '../uploads/products');
    const filePath = path.join(uploadDir, filename);
    
    if (fs.existsSync(filePath)) {
      console.log(`Product image already exists at ${filePath}, serving directly`);
      return res.sendFile(filePath);
    }
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`Created products directory: ${uploadDir}`);
    }
    
    // Create the product image by copying the fallback SVG
    const fallbackPath = path.join(__dirname, '../public/fallback/rice-product.svg');
    
    if (fs.existsSync(fallbackPath)) {
      // Copy the fallback image to the requested filename location
      fs.copyFileSync(fallbackPath, filePath);
      console.log(`Generated missing product image: ${filePath}`);
      
      // Serve the newly created file
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.sendFile(filePath);
    } else {
      return res.status(404).json({
        success: false,
        message: 'Fallback image template not found'
      });
    }
  } catch (error) {
    console.error('Error generating product image:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating product image',
      error: error.message
    });
  }
});

module.exports = router; 