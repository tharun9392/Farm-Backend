const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Set the MongoDB URI directly
const MONGO_URI = 'mongodb+srv://framerice:Tharun123@cluster0.gsns8pa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixAdminPassword() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Import the User model
    const User = require('./models/user.model');
    
    // Admin credentials
    const adminEmail = 'tharun@gmail.com';
    const adminPassword = 'Tharun@123';
    
    // Check if admin exists
    const existingUser = await User.findOne({ email: adminEmail });
    
    if (existingUser) {
      console.log(`Admin user with email ${adminEmail} found`);
      
      // Generate salt and hash manually
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      console.log('Generated hashed password:', hashedPassword);
      
      // Update password directly in the database
      await User.updateOne(
        { _id: existingUser._id },
        { 
          $set: {
            password: hashedPassword,
            role: 'admin',
            isActive: true,
            isVerified: true
          }
        }
      );
      
      console.log('Admin password updated successfully');
      
      // Verify the update was successful
      const updatedUser = await User.findOne({ email: adminEmail }).select('+password');
      if (updatedUser) {
        console.log('\nUpdated user details:');
        console.log('- ID:', updatedUser._id);
        console.log('- Name:', updatedUser.name);
        console.log('- Email:', updatedUser.email);
        console.log('- Role:', updatedUser.role);
        console.log('- Is Active:', updatedUser.isActive);
        console.log('- Is Verified:', updatedUser.isVerified);
        
        // Verify password works
        const isMatch = await bcrypt.compare(adminPassword, updatedUser.password);
        console.log(`- Password '${adminPassword}' matches:`, isMatch);
      }
    } else {
      console.log(`User with email ${adminEmail} not found`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixAdminPassword(); 