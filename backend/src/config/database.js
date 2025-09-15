const { MongoClient } = require('mongodb');

class DatabaseConnection {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect(config) {
    if (this.db) {
      return this.db;
    }

    try {
      this.client = new MongoClient(config.uri);
      await this.client.connect();
      this.db = this.client.db(config.dbName);
      
      console.log('✅ Connected to MongoDB');
      return this.db;
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('📴 Disconnected from MongoDB');
    }
  }

  getDb() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  isConnected() {
    return this.db !== null;
  }
}

module.exports = new DatabaseConnection();
