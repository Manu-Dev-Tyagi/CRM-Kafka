const { Kafka } = require('kafkajs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });

const dbConnection = require(path.resolve(__dirname, '../../backend/src/config/database'));
const CommunicationLogModel = require(path.resolve(__dirname, '../../backend/src/models/CommunicationLog'));

class StatusAggregatorWorker {
  constructor() {
    this.kafka = null;
    this.consumer = null;
    this.producer = null;
    this.commLog = CommunicationLogModel; // ✅ use instance directly
    this.stats = { processed: 0, errors: 0 };
  }

  async initialize(config) {
    this.kafka = new Kafka({
      clientId: config.clientId || 'status-aggregator',
      brokers: config.brokers,
      retry: { initialRetryTime: 100, retries: 8 }
    });

    this.consumer = this.kafka.consumer({ groupId: config.groupId || 'status-aggregator-group' });
    this.producer = this.kafka.producer();

    await this.consumer.connect();
    await this.producer.connect();

    await dbConnection.connect({
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME
    });

    // ✅ Subscribe to status_updates topic
    await this.consumer.subscribe({ topic: 'campaign.status_updates', fromBeginning: false });

    console.log('✅ Status Aggregator Worker initialized');
  }

  async start() {
    console.log('🚀 Starting Status Aggregator Worker...');

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        let update;
        try {
          update = JSON.parse(message.value.toString());
        } catch {
          this.stats.errors++;
          console.warn('⚠️ Invalid status update message, skipping');
          return;
        }

        const { send_id, status, error } = update;

        try {
          await this.commLog.updateStatus(send_id, status, error);
          this.stats.processed++;
          console.log(`📊 Updated status for send_id ${send_id}: ${status}`);
        } catch (err) {
          this.stats.errors++;
          console.error(`❌ Failed to update status for send_id ${send_id}:`, err.message);
        }
      }
    });
  }

  async stop() {
    try { await this.consumer.disconnect(); } catch {}
    try { await this.producer.disconnect(); } catch {}
    try { await dbConnection.disconnect(); } catch {}
    console.log('✅ Status Aggregator Worker stopped');
  }

  getStats() {
    return {
      worker: 'status-aggregator',
      processed: this.stats.processed,
      errors: this.stats.errors,
      isRunning: !!this.consumer,
      uptime: process.uptime()
    };
  }
}

module.exports = new StatusAggregatorWorker();
