/**
 * Password Reset and Admin Creation Script for Emergency Use
 * Run this script to reset a user's password or create an admin user directly in the database
 * Usage for password reset: node scripts/reset-password.js reset <email> <newPassword>
 * Usage for admin creation: node scripts/reset-password.js admin <email> <password> <name>
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './config.env' });

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// Reset password function
const resetPassword = async (email, newPassword) => {
  try {
    // Import the User model
    const User = require('../models/user.model');
    
    console.log(`Looking for user with email: ${email}`);
    
    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }
    
    console.log(`User found: ${user.name}`);
    
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the user's password
    user.password = hashedPassword;
    
    // Save the user
    await user.save();
    
    console.log(`Password for ${email} has been reset successfully!`);
    console.log('User can now log in with the new password.');
    
  } catch (error) {
    console.error(`Error resetting password: ${error.message}`);
    process.exit(1);
  }
};

// Create admin user function
const createAdminUser = async (email, password, name) => {
  try {
    // Import the User model
    const User = require('../models/user.model');
    
    console.log(`Checking if user with email: ${email} already exists`);
    
    // Find if user exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log(`User with email ${email} already exists.`);
      console.log(`Current role: ${existingUser.role}`);
      
      if (existingUser.role === 'admin') {
        console.log('User is already an admin.');
        
        // Ask if password should be reset
        console.log('Updating password...');
        
        // Generate salt
        const salt = await bcrypt.genSalt(10);
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Update password
        existingUser.password = hashedPassword;
        await existingUser.save();
        
        console.log(`Password for admin user ${email} has been updated.`);
      } else {
        console.log('Promoting user to admin role...');
        
        // Update role to admin
        existingUser.role = 'admin';
        
        // Save user
        await existingUser.save();
        
        console.log(`User ${email} has been promoted to admin role.`);
      }
      
      return;
    }
    
    console.log(`Creating new admin user with email: ${email}`);
    
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new admin user
    const newAdmin = new User({
      name: name || email.split('@')[0],
      email,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });
    
    // Save new admin
    await newAdmin.save();
    
    console.log(`New admin user created successfully:`);
    console.log(`- Email: ${email}`);
    console.log(`- Name: ${newAdmin.name}`);
    console.log(`- Role: ${newAdmin.role}`);
    
  } catch (error) {
    console.error(`Error creating admin user: ${error.message}`);
    process.exit(1);
  }
};

// Main function
const main = async () => {
  try {
    const command = process.argv[2] || 'help';
    
    if (command === 'help') {
      console.log('Usage for password reset: node scripts/reset-password.js reset <email> <newPassword>');
      console.log('Usage for admin creation: node scripts/reset-password.js admin <email> <password> <name>');
      process.exit(0);
    }
    
    // Connect to MongoDB
    await connectDB();
    
    if (command === 'reset') {
      const email = process.argv[3];
      const newPassword = process.argv[4];
      
      if (!email || !newPassword) {
        console.error('Email and new password are required for password reset');
        process.exit(1);
      }
      
      await resetPassword(email, newPassword);
    } else if (command === 'admin') {
      const email = process.argv[3] || 'tharun@gmail.com';
      const password = process.argv[4] || 'Tharun@123';
      const name = process.argv[5] || 'Tharun Admin';
      
      await createAdminUser(email, password, name);
    } else {
      console.error(`Unknown command: ${command}`);
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
    
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
    process.exit(1);
  }
};

// Run the main function
main(); 