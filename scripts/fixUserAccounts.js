/**
 * Script to fix user accounts - sets isActive to true and status to 'active'
 * Run with: node scripts/fixUserAccounts.js
 */
require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const { User } = require('../models');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

async function fixUserAccounts() {
  try {
    console.log('Starting to fix user accounts...');
    
    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} user(s) in the database`);
    
    let updatedCount = 0;
    
    // Update each user
    for (const user of users) {
      const needsUpdate = user.isActive !== true || user.status !== 'active';
      
      if (needsUpdate) {
        console.log(`Fixing user: ${user.email} (${user._id})`);
        user.isActive = true;
        user.status = 'active';
        await user.save();
        updatedCount++;
      }
    }
    
    console.log(`Fixed ${updatedCount} user account(s)`);
    console.log('All accounts now have isActive=true and status="active"');
    
    // Special case for specific email
    const specificUser = await User.findOne({ email: 'tharun@123gmail.com' });
    if (specificUser) {
      console.log(`Ensuring user ${specificUser.email} is specifically fixed:`);
      specificUser.isActive = true;
      specificUser.status = 'active';
      await specificUser.save();
      console.log(`User ${specificUser.email} is now active`);
    } else {
      console.log('User tharun@123gmail.com not found');
    }
    
  } catch (error) {
    console.error('Error fixing user accounts:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
}

fixUserAccounts(); 