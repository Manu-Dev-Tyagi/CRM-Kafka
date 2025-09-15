// backend/src/services/kafkaProducer.js
const { Kafka } = require('kafkajs');

let _kafka = null;
let _producer = null;
let _initialized = false;

async function initialize({ brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map(b => b.trim()), clientId = process.env.KAFKA_CLIENT_ID || 'mini-crm-api' } = {}) {
  if (_initialized && _producer) return;
  _kafka = new Kafka({
    clientId,
    brokers,
    retry: { initialRetryTime: 100, retries: 8 }
  });

  _producer = _kafka.producer();
  await _producer.connect();
  _initialized = true;
  console.log(`✅ Kafka producer connected (clientId=${clientId}, brokers=${brokers.join(',')})`);
}

function isInitialized() {
  return !!_producer && _initialized;
}

/**
 * send
 * @param {string} topic
 * @param {Array<{key:string, value:string}>|{key:string, value:string}} messages
 */
async function send(topic, messages) {
  if (!_producer) {
    // lazy-init with env defaults
    await initialize();
  }

  if (!Array.isArray(messages)) messages = [messages];

  // Ensure messages are shaped
  messages = messages.map(m => {
    if (typeof m.value !== 'string') {
      return { key: m.key, value: JSON.stringify(m.value) };
    }
    return m;
  });

  return _producer.send({ topic, messages });
}

async function publishDeliveryReceipt(vendorMessageId, campaignId, leadId, status, rawPayload = {}) {
  const message = {
    vendor_message_id: vendorMessageId,
    campaign_id: campaignId,
    lead_id: leadId,
    status: status.toLowerCase(),
    raw_payload: rawPayload,
    timestamp: new Date().toISOString()
  };

  return send('delivery.receipts', {
    key: vendorMessageId,
    value: message
  });
}

async function disconnect() {
  if (_producer) {
    try {
      await _producer.disconnect();
      console.log('📴 Kafka producer disconnected');
    } catch (e) {
      console.warn('⚠️ Error disconnecting Kafka producer:', e.message || e);
    } finally {
      _producer = null;
      _initialized = false;
    }
  }
}

module.exports = {
  initialize,
  isInitialized,
  isProducerConnected: isInitialized, // Alias for backward compatibility
  send,
  publishDeliveryReceipt,
  disconnect
};
