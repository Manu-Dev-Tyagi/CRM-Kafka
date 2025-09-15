// backend/src/routes/campaigns.js
const CampaignModel = require('../models/Campaign');
const SegmentModel = require('../models/Segment');
const LeadModel = require('../models/Lead');
const CommunicationLogModel = require('../models/CommunicationLog');
const astToMongoQuery = require('../utils/astToMongoQuery');
const kafkaProducer = require('../services/kafkaProducer');
const { Types } = require('mongodb');

async function campaignsRoutes(fastify, options) {

  // POST /api/v1/campaigns - Create new campaign
  fastify.post('/', async (req, reply) => {
    try {
      const { name, segment_id, message_template, created_by, audience } = req.body;

      if (!name || !segment_id || !message_template) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: name, segment_id, message_template'
        });
      }

      // Verify segment exists
      const segment = await SegmentModel.findById(segment_id);
      if (!segment) {
        return reply.status(404).send({ success: false, error: 'Segment not found' });
      }

      const campaign = await CampaignModel.create({
        name,
        segment_id,
        message_template,
        created_by: created_by || 'system',
        audience: audience || 0
      });

      return reply.status(201).send({
        success: true,
        data: campaign
      });

    } catch (error) {
      console.error('❌ Failed to create campaign:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create campaign'
      });
    }
  });

  // GET /api/v1/campaigns - List campaigns
  fastify.get('/', async (req, reply) => {
    try {
      const { page = 1, limit = 10, status, created_by } = req.query;

      const query = {};
      if (status) query.status = status.toUpperCase();
      if (created_by) query.created_by = created_by;

      const skip = (page - 1) * limit;
      const [campaigns, total] = await Promise.all([
        CampaignModel.findMany(query, { limit: parseInt(limit), skip, sort: { created_at: -1 } }),
        CampaignModel.count(query)
      ]);

      return reply.send({
        success: true,
        data: {
          campaigns,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('❌ Failed to list campaigns:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to list campaigns'
      });
    }
  });

  // GET /api/v1/campaigns/:id - Get single campaign with stats
  fastify.get('/:id', async (req, reply) => {
    try {
      const campaignId = req.params.id;
      const campaign = await CampaignModel.getCampaignWithStats(campaignId);

      if (!campaign) {
        return reply.status(404).send({ success: false, error: 'Campaign not found' });
      }

      return reply.send({ success: true, data: campaign });

    } catch (error) {
      console.error('❌ Failed to get campaign:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get campaign'
      });
    }
  });

  // PUT /api/v1/campaigns/:id/status - Update campaign status
  fastify.put('/:id/status', async (req, reply) => {
    try {
      const campaignId = req.params.id;
      const { status } = req.body;

      if (!status) {
        return reply.status(400).send({ success: false, error: 'Status is required' });
      }

      const result = await CampaignModel.updateStatus(campaignId, status);

      if (result.matchedCount === 0) {
        return reply.status(404).send({ success: false, error: 'Campaign not found' });
      }

      return reply.send({
        success: true,
        data: { message: `Campaign status updated to ${status.toUpperCase()}` }
      });

    } catch (error) {
      console.error('❌ Failed to update campaign status:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to update campaign status'
      });
    }
  });

  // POST run campaign
  fastify.post('/:id/run', async (req, reply) => {
    const campaignId = req.params.id;
    console.log(`\n🔥 Running campaign ${campaignId}...`);
    
    try {
      const campaign = await CampaignModel.findById(campaignId);
      if (!campaign) {
        console.warn(`⚠️ Campaign not found: ${campaignId}`);
        return reply.status(404).send({ success: false, error: 'Campaign not found' });
      }
      console.log(`🔹 Campaign fetched: ${campaign._id} - ${campaign.name}`);

      const segment = await SegmentModel.findById(campaign.segment_id);
      if (!segment) {
        console.warn(`⚠️ Segment not found: ${campaign.segment_id}`);
        return reply.status(404).send({ success: false, error: 'Segment not found' });
      }

      if (!segment.rule_ast || Object.keys(segment.rule_ast).length === 0) {
        console.warn(`⚠️ Segment AST is empty for segment ${segment._id}`);
        return reply.status(400).send({ success: false, error: 'Segment rule_ast is empty' });
      }

      // Translate AST to Mongo query
      let mongoQuery;
      try {
        mongoQuery = astToMongoQuery.translate(segment.rule_ast);
        console.log('✅ Translated AST to Mongo query:', JSON.stringify(mongoQuery, null, 2));
      } catch (err) {
        console.error('❌ Error translating AST to Mongo query:', err);
        return reply.status(400).send({ success: false, error: `Invalid segment AST: ${err.message}` });
      }

      // TEMP DEBUG: Check DB connection & query manually
      console.log('🔌 Checking DB connection...');
      const testLeads = await LeadModel.findMany({}, { limit: 5 });
      console.log('🔥 DEBUG: First 5 leads in DB:', testLeads.map(l => ({ _id: l._id.toString(), name: l.name })));

      // Fetch lead IDs matching segment query
      let leads = [];
      try {
        leads = await LeadModel.findMany(mongoQuery, { limit: 1000 });
        console.log(`✅ Fetched ${leads.length} lead(s) matching segment query`);
        leads.forEach(l => console.log('Lead:', l._id.toString(), l.name));
      } catch (err) {
        console.error('❌ Error fetching leads from DB:', err);
        return reply.status(500).send({ success: false, error: 'Failed to fetch leads' });
      }

      if (!leads.length) {
        console.warn(`⚠️ No leads matched for campaign ${campaignId}`);
        return reply.status(200).send({ success: true, message: `No leads matched for campaign ${campaignId}`, totalLeads: 0 });
      }

      const leadIds = leads.map(l => l._id.toString());

      // Ensure Kafka producer is initialized
      try {
        if (!kafkaProducer.isInitialized()) {
          const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
            .split(',')
            .map(b => b.trim());
          await kafkaProducer.initialize({ brokers, clientId: process.env.KAFKA_CLIENT_ID || 'mini-crm-api' });
          console.log('✅ Kafka producer initialized');
        }
      } catch (err) {
        console.error('❌ Kafka producer init error:', err);
        return reply.status(500).send({ success: false, error: 'Failed to initialize Kafka producer' });
      }

      // Publish job to Kafka
      try {
        const payload = { campaignId: campaign._id.toString(), leadIds };
        console.log('📤 Publishing campaign job to Kafka with payload:', payload);
        await kafkaProducer.send('campaign.jobs', [{ key: campaignId.toString(), value: JSON.stringify(payload) }]);
        console.log('✅ Campaign job published successfully');
      } catch (err) {
        console.error('❌ Failed to publish campaign job to Kafka:', err);
        return reply.status(500).send({ success: false, error: 'Failed to publish campaign job to Kafka' });
      }

      return reply.status(200).send({ success: true, message: `Campaign ${campaignId} triggered successfully`, totalLeads: leadIds.length });

    } catch (err) {
      console.error('❌ Unexpected error running campaign:', err);
      return reply.status(500).send({ success: false, error: err.message || 'Failed to run campaign' });
    }
  });
}

module.exports = campaignsRoutes;
