require('dotenv').config();

module.exports = {
  clientId: process.env.KAFKA_CLIENT_ID || 'backend-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  topics: {
    campaignJobs: process.env.KAFKA_TOPIC_CAMPAIGN_JOBS || 'campaign.jobs',
    sendJobs: process.env.KAFKA_TOPIC_SEND_JOBS || 'campaign.send_jobs',
    deliveryReceipts: process.env.KAFKA_TOPIC_DELIVERY_RECEIPTS || 'campaign.delivery_receipts',
    dlq: process.env.KAFKA_TOPIC_DLQ || 'campaign.dlq'
  }
};
