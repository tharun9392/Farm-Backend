const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Set the MongoDB URI directly
const MONGO_URI = 'mongodb+srv://framerice:Tharun123@cluster0.gsns8pa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkUser() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Get the User model
    const User = require('./models/user.model');
    
    // Find the admin user
    const user = await User.findOne({ email: 'tharun@gmail.com' }).select('+password');
    
    if (user) {
      console.log('User found:');
      console.log('- ID:', user._id);
      console.log('- Name:', user.name);
      console.log('- Email:', user.email);
      console.log('- Role:', user.role);
      console.log('- Password exists:', !!user.password);
      console.log('- Is Active:', user.isActive);
      console.log('- Is Verified:', user.isVerified);
      
      // Check password match
      const testPassword = 'Tharun@123';
      const isMatch = await bcrypt.compare(testPassword, user.password);
      console.log(`- Password '${testPassword}' matches:`, isMatch);
      
      // Try to hash the password with bcrypt directly as a test
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testPassword, salt);
      console.log('- Test hashed password:', hashedPassword);
      const testMatch = await bcrypt.compare(testPassword, hashedPassword);
      console.log('- Test password match:', testMatch);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkUser(); 