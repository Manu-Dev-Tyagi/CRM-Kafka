const dbConnection = require('../../src/config/database');
const leadModel = require('../../src/models/Lead');
const segmentModel = require('../../src/models/Segment');
const campaignModel = require('../../src/models/Campaign');
const kafkaProducer = require('../../src/services/kafkaProducer');
const astToMongoQuery = require('../../src/utils/astToMongoQuery');

// Mock Kafka for testing
jest.mock('kafkajs', () => ({
  Kafka: jest.fn(() => ({
    producer: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      send: jest.fn().mockResolvedValue([{ topicName: 'test', partition: 0, errorCode: 0 }])
    }))
  }))
}));

describe('Campaign Creation and Kafka Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    await dbConnection.connect({
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mini_crm_test',
      dbName: 'mini_crm_test'
    });

    // Initialize Kafka producer (mocked)
    await kafkaProducer.initialize({
      brokers: ['localhost:9092'],
      clientId: 'test-producer'
    });
  });

  afterAll(async () => {
    // Clean up
    await kafkaProducer.disconnect();
    await dbConnection.disconnect();
  });

  beforeEach(async () => {
    // Clear test data before each test
    const db = dbConnection.getDb();
    await db.collection('leads').deleteMany({});
    await db.collection('segments').deleteMany({});
    await db.collection('campaigns').deleteMany({});
    await db.collection('communication_logs').deleteMany({});
  });

  describe('Campaign Creation Flow', () => {
    test('should create campaign and publish to Kafka', async () => {
      // Seed test leads
      const testLeads = [
        {
          name: 'Customer 1',
          emails: ['customer1@example.com'],
          phones: ['+1234567890'],
          total_spend: 5000,
          visits: 3,
          last_order_at: new Date('2023-01-01'),
          metadata: { city: 'New York' }
        },
        {
          name: 'Customer 2',
          emails: ['customer2@example.com'],
          phones: ['+1234567891'],
          total_spend: 200,
          visits: 1,
          last_order_at: new Date('2023-02-01'),
          metadata: { city: 'Los Angeles' }
        },
        {
          name: 'Customer 3',
          emails: ['customer3@example.com'],
          phones: ['+1234567892'],
          total_spend: 8000,
          visits: 5,
          last_order_at: new Date('2023-03-01'),
          metadata: { city: 'Chicago' }
        },
        {
          name: 'Customer 4',
          emails: ['customer4@example.com'],
          phones: ['+1234567893'],
          total_spend: 1200,
          visits: 2,
          last_order_at: new Date('2023-04-01'),
          metadata: { city: 'Miami' }
        },
        {
          name: 'Customer 5',
          emails: ['customer5@example.com'],
          phones: ['+1234567894'],
          total_spend: 3000,
          visits: 4,
          last_order_at: new Date('2023-05-01'),
          metadata: { city: 'Seattle' }
        }
      ];

      const bulkResult = await leadModel.bulkUpsert(testLeads);
      expect(bulkResult.inserted).toBeGreaterThan(0);

      // Create segment for high spenders
      const segmentAST = {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 1000
      };

      const segment = await segmentModel.create({
        name: 'High Spenders Campaign',
        owner_user_id: '507f1f77bcf86cd799439011',
        rule_ast: segmentAST
      });

      // Get leads matching segment
      const mongoQuery = astToMongoQuery.translate(segmentAST);
      const matchingLeads = await leadModel.findMany(mongoQuery, { limit: 1000 });
      const leadIds = matchingLeads.map(lead => lead._id.toString());

      expect(leadIds.length).toBe(4); // Customer 1, 3, 4, 5

      // Create campaign
      const campaign = await campaignModel.create({
        name: 'High Spenders Promotion',
        segment_id: segment._id.toString(),
        message_template: 'Hi {{name}}, you\'re a valued customer! Get 20% off your next purchase.',
        created_by: '507f1f77bcf86cd799439011',
        audience: leadIds.length
      });

      expect(campaign.stats.audience).toBe(4);
      expect(campaign.status).toBe('initiated');

      // Test Kafka message publishing
      const chunkSize = 2; // Small chunks for testing
      const kafkaResults = await kafkaProducer.publishCampaignJobs(
        campaign._id.toString(),
        leadIds,
        chunkSize
      );

      expect(kafkaResults).toHaveLength(2); // 4 leads / 2 chunk size = 2 chunks
      expect(kafkaResults[0].customerCount).toBe(2);
      expect(kafkaResults[1].customerCount).toBe(2);

      // Update campaign status
      await campaignModel.updateStatus(campaign._id.toString(), 'running');
      const updatedCampaign = await campaignModel.findById(campaign._id.toString());
      expect(updatedCampaign.status).toBe('running');
    });

    test('should handle campaign with no matching leads', async () => {
      // Create segment with no matching leads
      const segmentAST = {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 100000 // Very high threshold
      };

      const segment = await segmentModel.create({
        name: 'Ultra High Spenders',
        owner_user_id: '507f1f77bcf86cd799439011',
        rule_ast: segmentAST
      });

      // Try to create campaign
      const mongoQuery = astToMongoQuery.translate(segmentAST);
      const matchingLeads = await leadModel.findMany(mongoQuery, { limit: 1000 });
      
      expect(matchingLeads.length).toBe(0);

      // This should fail in the actual API, but we can test the logic here
      try {
        const campaign = await campaignModel.create({
          name: 'Empty Campaign',
          segment_id: segment._id.toString(),
          message_template: 'Test message',
          created_by: '507f1f77bcf86cd799439011',
          audience: 0
        });

        // If we get here, the campaign was created with 0 audience
        expect(campaign.stats.audience).toBe(0);
      } catch (error) {
        // Expected behavior - campaign creation should fail with no leads
        expect(error.message).toContain('No leads found');
      }
    });

    test('should create communication logs for campaign', async () => {
      // Seed test data
      const testLeads = [
        {
          name: 'Test Customer',
          emails: ['test@example.com'],
          phones: ['+1234567890'],
          total_spend: 2000,
          visits: 2,
          last_order_at: new Date('2023-01-01'),
          metadata: { city: 'Test City' }
        }
      ];

      await leadModel.bulkUpsert(testLeads);

      // Create segment and campaign
      const segmentAST = {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 1000
      };

      const segment = await segmentModel.create({
        name: 'Test Segment',
        owner_user_id: '507f1f77bcf86cd799439011',
        rule_ast: segmentAST
      });

      const campaign = await campaignModel.create({
        name: 'Test Campaign',
        segment_id: segment._id.toString(),
        message_template: 'Hello {{name}}!',
        created_by: '507f1f77bcf86cd799439011',
        audience: 1
      });

      // Create communication logs (this would normally be done by the job expander worker)
      const communicationLogModel = require('../../src/models/CommunicationLog');
      const lead = await leadModel.findMany({}, { limit: 1 });
      
      const logs = [{
        campaign_id: campaign._id.toString(),
        lead_id: lead[0]._id.toString(),
        message: 'Hello Test Customer!',
        status: 'PENDING'
      }];

      const logResult = await communicationLogModel.bulkUpsert(logs);
      expect(logResult.inserted).toBe(1);

      // Verify campaign stats
      const campaignWithStats = await campaignModel.getCampaignWithStats(campaign._id.toString());
      expect(campaignWithStats.stats).toHaveProperty('PENDING', 1);
    });
  });

  describe('Kafka Message Publishing', () => {
    test('should publish campaign jobs with correct structure', async () => {
      const campaignId = '507f1f77bcf86cd799439011';
      const customerIds = ['lead1', 'lead2', 'lead3', 'lead4', 'lead5'];
      const chunkSize = 2;

      const results = await kafkaProducer.publishCampaignJobs(campaignId, customerIds, chunkSize);

      expect(results).toHaveLength(3); // 5 leads / 2 chunk size = 3 chunks (2, 2, 1)
      expect(results[0].customerCount).toBe(2);
      expect(results[1].customerCount).toBe(2);
      expect(results[2].customerCount).toBe(1);

      // Verify job IDs are unique
      const jobIds = results.map(r => r.jobId);
      const uniqueJobIds = [...new Set(jobIds)];
      expect(uniqueJobIds.length).toBe(jobIds.length);
    });

    test('should publish send job messages', async () => {
      const sendId = 'send-123';
      const campaignId = 'campaign-456';
      const leadId = 'lead-789';
      const message = 'Hello John!';
      const attempt = 1;

      const result = await kafkaProducer.publishCampaignSendJob(
        sendId,
        campaignId,
        leadId,
        message,
        attempt
      );

      expect(result).toBeDefined();
    });

    test('should publish delivery receipt messages', async () => {
      const vendorMessageId = 'vmsg-123';
      const campaignId = 'campaign-456';
      const leadId = 'lead-789';
      const status = 'DELIVERED';
      const rawPayload = { timestamp: new Date().toISOString() };

      const result = await kafkaProducer.publishDeliveryReceipt(
        vendorMessageId,
        campaignId,
        leadId,
        status,
        rawPayload
      );

      expect(result).toBeDefined();
    });
  });
});
