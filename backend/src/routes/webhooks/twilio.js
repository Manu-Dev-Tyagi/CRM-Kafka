// backend/src/routes/webhooks/twilio.js

const {
    Kafka
  } = require('kafkajs');
  
  const kafka = new Kafka({
    clientId: 'mini-crm-webhook-producer',
    brokers: [process.env.KAFKA_BROKERS]
  });
  const producer = kafka.producer();
  
  async function twilioWebhookRoutes(fastify, options) {
    await producer.connect();
  
    fastify.post('/status-callback', async (request, reply) => {
      try {
        // The Twilio webhook sends form data, not JSON
        const twilioData = request.body;
        const messageSid = twilioData.MessageSid;
        const messageStatus = twilioData.MessageStatus;
  
        // Find the log in your database using the message SID
        // This step may need to be modified based on how you store Twilio's SID
        // For now, let's assume we can get it from the message log itself
        const messageLog = await fastify.mongo.db.collection('communication_logs').findOne({
          twilio_sid: messageSid
        });
  
        if (!messageLog) {
          fastify.log.warn(`Webhook received for unknown message SID: ${messageSid}`);
          return reply.code(200).send();
        }
  
        const updatePayload = {
          _id: messageLog._id,
          status: messageStatus.toUpperCase() // e.g., 'DELIVERED', 'FAILED', 'SENT'
        };
  
        // Publish the status update to the new Kafka topic
        await producer.send({
          topic: 'campaign-status-updates',
          messages: [{
            value: JSON.stringify(updatePayload)
          }],
        });
  
        return reply.code(200).send({
          success: true
        });
  
      } catch (error) {
        fastify.log.error('Twilio webhook error:', error);
        return reply.code(500).send({
          success: false
        });
      }
    });
  }
  
  module.exports = twilioWebhookRoutes;