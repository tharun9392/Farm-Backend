const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Set the MongoDB URI directly
const MONGO_URI = 'mongodb+srv://framerice:Tharun123@cluster0.gsns8pa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function createAdminUser() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Import the User model properly
    const User = require('./models/user.model');
    
    // Admin credentials
    const adminEmail = 'tharun@123gmail.com';
    const adminPassword = 'Tharun@123';
    const adminName = 'Tharun Admin';
    
    // Check if admin already exists
    const existingUser = await User.findOne({ email: adminEmail });
    
    // Generate salt and hash manually
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    console.log('Generated hashed password:', hashedPassword);
    
    if (existingUser) {
      console.log(`Admin user with email ${adminEmail} already exists`);
      console.log('Updating user...');
      
      // Update user directly in the database to bypass mongoose middleware
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
      
      console.log('Admin user updated successfully');
    } else {
      console.log(`Creating new admin user with email ${adminEmail}`);
      
      // Create new admin user directly in MongoDB
      const newAdmin = {
        name: adminName,
        email: adminEmail,
        password: hashedPassword, // Use the manually hashed password
        role: 'admin',
        isActive: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await mongoose.connection.collection('users').insertOne(newAdmin);
      console.log('New admin user created successfully');
    }
    
    // Verify the user was created/updated correctly
    const adminUser = await User.findOne({ email: adminEmail }).select('+password');
    if (adminUser) {
      console.log('\nAdmin user details:');
      console.log('- ID:', adminUser._id);
      console.log('- Name:', adminUser.name);
      console.log('- Email:', adminUser.email);
      console.log('- Role:', adminUser.role);
      console.log('- Is Active:', adminUser.isActive);
      console.log('- Is Verified:', adminUser.isVerified);
      console.log('- Stored password hash:', adminUser.password);
      
      // Verify password works
      const isMatch = await bcrypt.compare(adminPassword, adminUser.password);
      console.log(`- Password '${adminPassword}' matches:`, isMatch);
      
      // Double-check with another method
      const manualMatch = await bcrypt.compare(adminPassword, hashedPassword);
      console.log('- Manual password match check:', manualMatch);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createAdminUser(); 