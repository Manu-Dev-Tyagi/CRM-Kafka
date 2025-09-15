// Test setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mini_crm_test';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';

// Global test timeout
jest.setTimeout(10000);
