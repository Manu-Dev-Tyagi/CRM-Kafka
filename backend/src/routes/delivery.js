const kafkaProducer = require('../services/kafkaProducer');
const crypto = require('crypto');

async function deliveryRoutes(fastify, options) {
  // Validation schemas
  const deliveryReceiptSchema = {
    type: 'object',
    required: ['vendor_message_id', 'campaign_id', 'lead_id', 'status'],
    properties: {
      vendor_message_id: { type: 'string' },
      campaign_id: { type: 'string' },
      lead_id: { type: 'string' },
      status: { type: 'string', enum: ['DELIVERED', 'FAILED'] },
      signature: { type: 'string' },
      raw_payload: { type: 'object' }
    }
  };

  // POST /api/v1/delivery/receipt - Webhook for delivery receipts
  fastify.post('/receipt', {
    schema: {
      body: deliveryReceiptSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { 
        vendor_message_id, 
        campaign_id, 
        lead_id, 
        status, 
        signature, 
        raw_payload = {} 
      } = request.body;

      // Verify signature if provided
      if (signature) {
        const webhookSecret = process.env.VENDOR_WEBHOOK_SECRET || 'dev-webhook-secret';
        const payload = JSON.stringify({
          vendor_message_id,
          campaign_id,
          lead_id,
          status,
          raw_payload
        });
        
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(payload)
          .digest('hex');

        if (signature !== expectedSignature) {
          fastify.log.warn('Invalid signature for delivery receipt:', vendor_message_id);
          return reply.code(401).send({
            success: false,
            error: 'Invalid signature'
          });
        }
      }

      // Publish to Kafka for processing by receipt worker
      await kafkaProducer.publishDeliveryReceipt(
        vendor_message_id,
        campaign_id,
        lead_id,
        status,
        raw_payload
      );

      fastify.log.info(`Delivery receipt processed: ${vendor_message_id} - ${status}`);

      return {
        success: true,
        message: 'Delivery receipt received and queued for processing'
      };
    } catch (error) {
      fastify.log.error('Delivery receipt error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to process delivery receipt'
      });
    }
  });

  // GET /api/v1/delivery/status - Health check for delivery webhook
  fastify.get('/status', async (request, reply) => {
    return {
      success: true,
      message: 'Delivery webhook is healthy',
      timestamp: new Date().toISOString()
    };
  });
}

module.exports = deliveryRoutes;
