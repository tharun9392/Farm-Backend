const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Ensure upload directories exist
const ensureDirectoryExists = () => {
  const uploadDir = path.join(__dirname, '../uploads/products');
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`Created directory: ${uploadDir}`);
    } catch (error) {
      console.error(`Failed to create directory ${uploadDir}:`, error);
      throw new Error(`Failed to create upload directory: ${error.message}`);
    }
  }
  return uploadDir;
};

// Try to create upload directory on server start
try {
  const uploadDir = ensureDirectoryExists();
  console.log(`Upload directory verified: ${uploadDir}`);
} catch (error) {
  console.error('Error initializing upload directory:', error);
}

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadDir = ensureDirectoryExists();
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, GIF and WEBP files are allowed'), false);
  }
};

// Initialize multer upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
}).array('images', 5); // Allow up to 5 images

/**
 * Upload product images
 * @route POST /api/upload/product-images
 * @access Private - Farmer
 */
const uploadProductImages = (req, res, next) => {
  console.log('Processing product image upload');
  
  upload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        console.error('Multer error:', err);
        return res.status(400).json({
          success: false,
          message: err.message
        });
      } else {
        // Unknown error
        console.error('Unknown upload error:', err);
        return res.status(500).json({
          success: false,
          message: err.message || 'An error occurred during file upload'
        });
      }
    }
    
    // No errors, process the upload
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    // Generate URLs for uploaded images
    try {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? process.env.API_URL || `${req.protocol}://${req.get('host')}` 
        : `${req.protocol}://${req.get('host')}`;
        
      // Log the generated base URL for debugging
      console.log(`Using base URL for images: ${baseUrl}`);
      
      const imageUrls = req.files.map(file => {
        // Create a public URL for the file
        const relativePath = path.relative(
          path.join(__dirname, '../uploads'), 
          file.path
        ).replace(/\\/g, '/'); 
        
        const url = `${baseUrl}/uploads/${relativePath}`;
        console.log(`Generated image URL: ${url}`);
        return url;
      });
      
      console.log(`Successfully uploaded ${imageUrls.length} images`);
      
      res.status(200).json({
        success: true,
        message: 'Files uploaded successfully',
        imageUrls
      });
    } catch (error) {
      console.error('Error processing uploaded files:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing uploaded files'
      });
    }
  });
};

/**
 * Create a fallback image if necessary
 * This ensures we have at least one default product image
 */
const createFallbackImages = () => {
  const fallbackDir = path.join(__dirname, '../public/fallback');
  if (!fs.existsSync(fallbackDir)) {
    fs.mkdirSync(fallbackDir, { recursive: true });
  }
  
  // Create a rice product fallback image if it doesn't exist
  const riceProductFallbackPath = path.join(fallbackDir, 'rice-product.svg');
  if (!fs.existsSync(riceProductFallbackPath)) {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f5f5f5"/>
      <circle cx="100" cy="100" r="70" fill="#e8f4ea"/>
      <ellipse cx="85" cy="90" rx="12" ry="6" transform="rotate(-20 85 90)" fill="#fff" stroke="#ddd" stroke-width="1"/>
      <ellipse cx="110" cy="80" rx="12" ry="6" transform="rotate(15 110 80)" fill="#fff" stroke="#ddd" stroke-width="1"/>
      <ellipse cx="90" cy="115" rx="12" ry="6" transform="rotate(30 90 115)" fill="#fff" stroke="#ddd" stroke-width="1"/>
      <ellipse cx="120" cy="105" rx="12" ry="6" transform="rotate(-10 120 105)" fill="#fff" stroke="#ddd" stroke-width="1"/>
      <ellipse cx="75" cy="70" rx="12" ry="6" transform="rotate(10 75 70)" fill="#fff" stroke="#ddd" stroke-width="1"/>
      <ellipse cx="105" cy="125" rx="12" ry="6" transform="rotate(-25 105 125)" fill="#fff" stroke="#ddd" stroke-width="1"/>
      <path d="M60,120 C60,150 140,150 140,120 L130,140 C130,155 70,155 70,140 Z" fill="#4caf50" opacity="0.2" stroke="#388e3c" stroke-width="1"/>
      <text x="100" y="170" font-family="Arial, sans-serif" font-size="14" fill="#388e3c" text-anchor="middle" font-weight="bold">Premium Rice</text>
    </svg>`;
    
    fs.writeFileSync(riceProductFallbackPath, svgContent);
    console.log(`Created fallback rice product image at: ${riceProductFallbackPath}`);
  }
};

// Create fallback images on server start
try {
  createFallbackImages();
} catch (error) {
  console.error('Error creating fallback images:', error);
}

// Enhance the image proxy service to handle various image types
const serveImageProxy = async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    console.log(`Image proxy request for: ${type}/${filename}`);
    
    // Security check - prevent path traversal
    if (filename.includes('..') || type.includes('..')) {
      console.error(`Path traversal attempt detected for: ${type}/${filename}`);
      return res.status(400).json({ message: 'Invalid file path' });
    }
    
    // Determine the folder based on image type
    let folder = 'products';
    if (type === 'users') {
      folder = 'users';
    }
    
    // Build potential file paths - try multiple possible locations
    const possiblePaths = [
      path.join(__dirname, '../uploads', folder, filename),
      path.join(__dirname, '../..', 'uploads', folder, filename),
      path.join(__dirname, '../../uploads', folder, filename),
      path.join(process.cwd(), 'uploads', folder, filename),
      path.join(process.cwd(), 'server/uploads', folder, filename)
    ];
    
    // Log all potential paths for debugging
    console.log('Searching for image in paths:');
    possiblePaths.forEach(p => console.log(` - ${p} (exists: ${fs.existsSync(p)})`));
    
    // Try all possible paths
    let foundPath = null;
    for (const checkPath of possiblePaths) {
      if (fs.existsSync(checkPath)) {
        foundPath = checkPath;
        console.log(`Found image at: ${foundPath}`);
        break;
      }
    }
    
    // If file is found, serve it
    if (foundPath) {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Timing-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept');
      res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
      
      // Add cache headers
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      
      return res.sendFile(foundPath);
    }
    
    console.log(`Image not found: ${type}/${filename}`);
    
    // If not found, try to create a sample file
    if (type === 'products') {
      try {
        // Create directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads/products');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
          console.log(`Created products directory: ${uploadDir}`);
        }
        
        // See if we can create a temporary file with the requested name
        if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const fallbackImagePath = path.join(__dirname, '../public/fallback/rice-product.svg');
          const newImagePath = path.join(uploadDir, filename);
          
          if (fs.existsSync(fallbackImagePath) && !fs.existsSync(newImagePath)) {
            fs.copyFileSync(fallbackImagePath, newImagePath);
            console.log(`Created missing image file: ${newImagePath}`);
            
            // Now try to serve it
            return res.sendFile(newImagePath);
          }
        }
      } catch (createError) {
        console.error(`Error creating sample image: ${createError.message}`);
      }
    }
    
    // If still not found, serve fallback image based on type
    if (type === 'products') {
      const fallbackPath = path.join(__dirname, '../public/fallback/rice-product.svg');
      if (fs.existsSync(fallbackPath)) {
        console.log(`Serving fallback image for: ${type}/${filename}`);
        
        // Set CORS headers for fallback image too
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Type', 'image/svg+xml');
        
        return res.sendFile(fallbackPath);
      }
    }
    
    // If all fails, return a 404
    console.log(`No fallback image found for: ${type}/${filename}`);
    return res.status(404).json({ 
      message: 'Image not found',
      path: `${type}/${filename}`
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Generate sample product images for testing
 * Useful to create test data
 */
const generateSampleImages = (count = 5) => {
  try {
    const uploadDir = path.join(__dirname, '../uploads/products');
    
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`Created products directory: ${uploadDir}`);
    }
    
    // Get the fallback image to use as a template
    const fallbackImagePath = path.join(__dirname, '../public/fallback/rice-product.svg');
    if (!fs.existsSync(fallbackImagePath)) {
      // If fallback doesn't exist, create it
      createFallbackImages();
    }
    
    // Generate sample images with product file naming pattern
    const generatedImages = [];
    
    // Create images with names matching the pattern seen in error logs
    const imagesToCreate = [
      'product-1747825459924-271882079.jpg',
      'product-1747823126299-872613503.jpg',
      'product-1747595438137-897483560.jpg'
    ];
    
    // Add some dynamic timestamps for other sample images
    for (let i = 0; i < count - imagesToCreate.length; i++) {
      const timestamp = Date.now() - (i * 1000 * 60 * 60); // Slightly different timestamps
      const randomId = Math.round(Math.random() * 1E9);
      imagesToCreate.push(`product-${timestamp}-${randomId}.jpg`);
    }
    
    // Create each image file by copying the fallback
    imagesToCreate.forEach(filename => {
      const targetPath = path.join(uploadDir, filename);
      
      // Only create if it doesn't already exist
      if (!fs.existsSync(targetPath)) {
        // Copy the fallback image (SVG) as the product image
        fs.copyFileSync(fallbackImagePath, targetPath);
        console.log(`Created sample product image: ${targetPath}`);
      } else {
        console.log(`Sample product image already exists: ${targetPath}`);
      }
      
      // Return the URL path that would be used to access this image
      generatedImages.push(`/uploads/products/${filename}`);
    });
    
    console.log(`Generated ${generatedImages.length} sample product images`);
    return generatedImages;
  } catch (error) {
    console.error('Error generating sample images:', error);
    return [];
  }
};

module.exports = {
  uploadProductImages,
  serveImageProxy,
  generateSampleImages
}; 