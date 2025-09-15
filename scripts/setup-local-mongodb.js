#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://localhost:27017/mini_crm';
const INIT_SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'mongo-init.js');

async function setupLocalMongoDB() {
  console.log('🔧 Setting up local MongoDB for Mini CRM...');
  
  let client;
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('mini_crm');
    console.log('✅ Connected to MongoDB');
    
    // Check if database is already initialized
    const collections = await db.listCollections().toArray();
    if (collections.length > 0) {
      console.log('📋 Database already initialized with collections:', collections.map(c => c.name).join(', '));
      console.log('⚠️  Skipping initialization. If you want to reinitialize, drop the database first.');
      return;
    }
    
    // Read and execute the initialization script
    console.log('📝 Reading initialization script...');
    const initScript = fs.readFileSync(INIT_SCRIPT_PATH, 'utf8');
    
    // Execute the initialization script
    console.log('🚀 Executing database initialization...');
    await db.eval(initScript);
    
    console.log('✅ Database initialized successfully!');
    console.log('📊 Created collections: leads, orders, segments, campaigns, communication_logs, users');
    console.log('🔍 Created indexes for optimal performance');
    
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      console.error('❌ Cannot connect to MongoDB. Please make sure MongoDB is running locally.');
      console.error('   Install: brew install mongodb-community');
      console.error('   Start: brew services start mongodb-community');
      console.error('   Or: mongod --dbpath /usr/local/var/mongodb');
    } else {
      console.error('❌ Error setting up MongoDB:', error.message);
    }
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run setup
setupLocalMongoDB().catch(console.error);
