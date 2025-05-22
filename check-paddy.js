const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'config.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
      process.env.MONGO_URI = process.env.MONGODB_URI;
      console.log('Using MONGODB_URI instead of MONGO_URI');
    }

    if (!process.env.MONGO_URI) {
      console.error('MongoDB URI not found');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Check upload directories
const checkUploadDirectories = () => {
  const uploadDirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads/products'),
    path.join(__dirname, 'uploads/users')
  ];
  
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created missing upload directory: ${dir}`);
      } catch (error) {
        console.error(`Failed to create upload directory ${dir}:`, error);
      }
    } else {
      console.log(`Directory exists: ${dir}`);
    }
  });
};

// Main function
const main = async () => {
  await connectDB();
  
  // Check upload directories
  checkUploadDirectories();

  // Load Product model
  const Product = require('./models/product.model');
  const User = require('./models/user.model');
  
  // List pending products
  try {
    const pendingProducts = await Product.find({ status: 'pending' })
      .populate('farmer', 'name email role');
    
    console.log(`Found ${pendingProducts.length} pending products`);
    
    if (pendingProducts.length > 0) {
      // Print details of each pending product
      pendingProducts.forEach((product, index) => {
        console.log(`\n--- Pending Product ${index + 1} ---`);
        console.log(`ID: ${product._id}`);
        console.log(`Name: ${product.name}`);
        console.log(`Status: ${product.status}`);
        console.log(`Is Processed Rice: ${product.isProcessedRice}`);
        console.log(`Created: ${product.createdAt}`);
        console.log(`Farmer: ${product.farmer?.name || 'Unknown'} (${product.farmer?.email || 'No email'})`);
        console.log(`Images: ${product.images.length}`);
        
        // Check each image file
        product.images.forEach((imageUrl, imgIndex) => {
          console.log(`  Image ${imgIndex + 1}: ${imageUrl}`);
          
          // Try to extract the filename from the URL
          let filename = '';
          if (imageUrl.includes('/uploads/products/')) {
            const parts = imageUrl.split('/uploads/products/');
            filename = parts[parts.length - 1];
          } else if (imageUrl.startsWith('http')) {
            try {
              const urlObj = new URL(imageUrl);
              const pathParts = urlObj.pathname.split('/');
              filename = pathParts[pathParts.length - 1];
            } catch (error) {
              console.error(`  Error parsing URL: ${error.message}`);
              filename = '';
            }
          }
          
          if (filename) {
            // Check if the file exists
            const filePath = path.join(__dirname, 'uploads/products', filename);
            const exists = fs.existsSync(filePath);
            console.log(`  File exists: ${exists ? 'Yes' : 'No'} (${filePath})`);
            
            if (!exists) {
              console.log(`  !!! FILE MISSING !!!`);
            }
          } else {
            console.log(`  Unable to extract filename from URL`);
          }
        });
      });
    }
    
    // Count farmers
    const farmerCount = await User.countDocuments({ role: 'farmer' });
    console.log(`\nTotal farmers in the system: ${farmerCount}`);
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
};

// Run the main function
main().catch(console.error); 