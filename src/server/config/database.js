const mongoose = require('mongoose');

const connectDB = async () => {
  // Skip database connection if MongoDB URI is not configured or in development mode
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI === 'mongodb://localhost:27017/rita-sms-platform') {
    console.log('⚠️  MongoDB not configured or not running locally. Database features will be disabled.');
    console.log('   To enable database:');
    console.log('   1. Install MongoDB locally or use MongoDB Atlas');
    console.log('   2. Update MONGODB_URI in .env file');
    return { connected: false };
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return { connected: true, host: conn.connection.host };
  } catch (error) {
    console.warn('⚠️  Database connection failed:', error.message);
    console.log('   Continuing without database - some features will be disabled');
    return { connected: false, error: error.message };
  }
};

module.exports = connectDB;