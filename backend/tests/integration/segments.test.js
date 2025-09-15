const dbConnection = require('../../src/config/database');
const leadModel = require('../../src/models/Lead');
const segmentModel = require('../../src/models/Segment');
const astToMongoQuery = require('../../src/utils/astToMongoQuery');

describe('Segments Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    await dbConnection.connect({
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mini_crm_test',
      dbName: 'mini_crm_test'
    });
  });

  afterAll(async () => {
    // Clean up and disconnect
    await dbConnection.disconnect();
  });

  beforeEach(async () => {
    // Clear test data before each test
    const db = dbConnection.getDb();
    await db.collection('leads').deleteMany({});
    await db.collection('segments').deleteMany({});
  });

  describe('Segment Preview with Real Data', () => {
    test('should preview segment with high spenders', async () => {
      // Seed test data
      const testLeads = [
        {
          name: 'John Doe',
          emails: ['john@example.com'],
          phones: ['+1234567890'],
          total_spend: 5000,
          visits: 3,
          last_order_at: new Date('2023-01-01'),
          metadata: { city: 'New York' }
        },
        {
          name: 'Jane Smith',
          emails: ['jane@example.com'],
          phones: ['+1234567891'],
          total_spend: 200,
          visits: 1,
          last_order_at: new Date('2023-02-01'),
          metadata: { city: 'Los Angeles' }
        },
        {
          name: 'Bob Johnson',
          emails: ['bob@example.com'],
          phones: ['+1234567892'],
          total_spend: 8000,
          visits: 5,
          last_order_at: new Date('2023-03-01'),
          metadata: { city: 'Chicago' }
        }
      ];

      await leadModel.bulkUpsert(testLeads);

      // Create segment for high spenders (> 1000)
      const segmentAST = {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 1000
      };

      const segment = await segmentModel.create({
        name: 'High Spenders',
        owner_user_id: '507f1f77bcf86cd799439011', // Mock ObjectId
        rule_ast: segmentAST
      });

      // Test AST translation
      const mongoQuery = astToMongoQuery.translate(segmentAST);
      expect(mongoQuery).toEqual({
        total_spend: { $gt: 1000 }
      });

      // Test preview
      const [count, sample] = await Promise.all([
        leadModel.count(mongoQuery),
        leadModel.findMany(mongoQuery, { limit: 10 })
      ]);

      expect(count).toBe(2); // John Doe and Bob Johnson
      expect(sample).toHaveLength(2);
      expect(sample.every(lead => lead.total_spend > 1000)).toBe(true);

      // Update segment preview count
      await segmentModel.updatePreviewCount(segment._id.toString(), count);
      const updatedSegment = await segmentModel.findById(segment._id.toString());
      expect(updatedSegment.last_preview_count).toBe(2);
    });

    test('should preview segment with complex AND condition', async () => {
      // Seed test data
      const testLeads = [
        {
          name: 'Alice Brown',
          emails: ['alice@example.com'],
          phones: ['+1234567893'],
          total_spend: 3000,
          visits: 2,
          last_order_at: new Date('2023-01-15'),
          metadata: { city: 'Seattle' }
        },
        {
          name: 'Charlie Wilson',
          emails: ['charlie@example.com'],
          phones: ['+1234567894'],
          total_spend: 4000,
          visits: 8,
          last_order_at: new Date('2023-02-15'),
          metadata: { city: 'Miami' }
        },
        {
          name: 'Diana Lee',
          emails: ['diana@example.com'],
          phones: ['+1234567895'],
          total_spend: 1500,
          visits: 1,
          last_order_at: new Date('2023-03-15'),
          metadata: { city: 'Denver' }
        }
      ];

      await leadModel.bulkUpsert(testLeads);

      // Create segment for high spenders with low visits
      const segmentAST = {
        op: 'AND',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '>',
            value: 2000
          },
          {
            type: 'condition',
            field: 'visits',
            operator: '<',
            value: 5
          }
        ]
      };

      const mongoQuery = astToMongoQuery.translate(segmentAST);
      expect(mongoQuery).toEqual({
        $and: [
          { total_spend: { $gt: 2000 } },
          { visits: { $lt: 5 } }
        ]
      });

      // Test preview
      const [count, sample] = await Promise.all([
        leadModel.count(mongoQuery),
        leadModel.findMany(mongoQuery, { limit: 10 })
      ]);

      expect(count).toBe(1); // Only Alice Brown (3000 spend, 2 visits)
      expect(sample).toHaveLength(1);
      expect(sample[0].name).toBe('Alice Brown');
    });

    test('should preview segment with OR condition', async () => {
      // Seed test data
      const testLeads = [
        {
          name: 'Eve Davis',
          emails: ['eve@example.com'],
          phones: ['+1234567896'],
          total_spend: 100,
          visits: 12,
          last_order_at: new Date('2023-01-20'),
          metadata: { city: 'Boston' }
        },
        {
          name: 'Frank Miller',
          emails: ['frank@example.com'],
          phones: ['+1234567897'],
          total_spend: 6000,
          visits: 2,
          last_order_at: new Date('2023-02-20'),
          metadata: { city: 'Phoenix' }
        },
        {
          name: 'Grace Taylor',
          emails: ['grace@example.com'],
          phones: ['+1234567898'],
          total_spend: 800,
          visits: 3,
          last_order_at: new Date('2023-03-20'),
          metadata: { city: 'Atlanta' }
        }
      ];

      await leadModel.bulkUpsert(testLeads);

      // Create segment for high spenders OR frequent visitors
      const segmentAST = {
        op: 'OR',
        children: [
          {
            type: 'condition',
            field: 'total_spend',
            operator: '>',
            value: 5000
          },
          {
            type: 'condition',
            field: 'visits',
            operator: '>',
            value: 10
          }
        ]
      };

      const mongoQuery = astToMongoQuery.translate(segmentAST);
      expect(mongoQuery).toEqual({
        $or: [
          { total_spend: { $gt: 5000 } },
          { visits: { $gt: 10 } }
        ]
      });

      // Test preview
      const [count, sample] = await Promise.all([
        leadModel.count(mongoQuery),
        leadModel.findMany(mongoQuery, { limit: 10 })
      ]);

      expect(count).toBe(2); // Eve Davis (12 visits) and Frank Miller (6000 spend)
      expect(sample).toHaveLength(2);
      expect(sample.some(lead => lead.name === 'Eve Davis')).toBe(true);
      expect(sample.some(lead => lead.name === 'Frank Miller')).toBe(true);
    });

    test('should preview segment with date condition', async () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Seed test data
      const testLeads = [
        {
          name: 'Henry Clark',
          emails: ['henry@example.com'],
          phones: ['+1234567899'],
          total_spend: 2000,
          visits: 4,
          last_order_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          metadata: { city: 'Portland' }
        },
        {
          name: 'Ivy Rodriguez',
          emails: ['ivy@example.com'],
          phones: ['+1234567800'],
          total_spend: 1500,
          visits: 2,
          last_order_at: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
          metadata: { city: 'Austin' }
        },
        {
          name: 'Jack White',
          emails: ['jack@example.com'],
          phones: ['+1234567801'],
          total_spend: 3000,
          visits: 6,
          last_order_at: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
          metadata: { city: 'Nashville' }
        }
      ];

      await leadModel.bulkUpsert(testLeads);

      // Create segment for inactive customers (no order in last 3 months)
      const segmentAST = {
        type: 'condition',
        field: 'last_order_at',
        operator: '<',
        value: '3 months ago'
      };

      const mongoQuery = astToMongoQuery.translate(segmentAST);
      
      // Test preview
      const [count, sample] = await Promise.all([
        leadModel.count(mongoQuery),
        leadModel.findMany(mongoQuery, { limit: 10 })
      ]);

      expect(count).toBe(2); // Ivy Rodriguez and Jack White
      expect(sample).toHaveLength(2);
      expect(sample.every(lead => lead.last_order_at < threeMonthsAgo)).toBe(true);
    });

    test('should preview segment with array field condition', async () => {
      // Seed test data
      const testLeads = [
        {
          name: 'Kate Anderson',
          emails: ['kate@example.com', 'kate.anderson@company.com'],
          phones: ['+1234567802'],
          total_spend: 2500,
          visits: 3,
          last_order_at: new Date('2023-01-25'),
          metadata: { city: 'San Francisco' }
        },
        {
          name: 'Liam Thompson',
          emails: ['liam@example.com'],
          phones: ['+1234567803', '+1987654321'],
          total_spend: 1800,
          visits: 2,
          last_order_at: new Date('2023-02-25'),
          metadata: { city: 'San Diego' }
        },
        {
          name: 'Maya Patel',
          emails: ['maya@example.com'],
          phones: ['+1234567804'],
          total_spend: 3200,
          visits: 4,
          last_order_at: new Date('2023-03-25'),
          metadata: { city: 'Houston' }
        }
      ];

      await leadModel.bulkUpsert(testLeads);

      // Create segment for leads with multiple emails
      const segmentAST = {
        type: 'condition',
        field: 'emails',
        operator: 'CONTAINS',
        value: 'company.com'
      };

      const mongoQuery = astToMongoQuery.translate(segmentAST);
      expect(mongoQuery).toEqual({
        emails: { $regex: 'company.com', $options: 'i' }
      });

      // Test preview
      const [count, sample] = await Promise.all([
        leadModel.count(mongoQuery),
        leadModel.findMany(mongoQuery, { limit: 10 })
      ]);

      expect(count).toBe(1); // Only Kate Anderson
      expect(sample).toHaveLength(1);
      expect(sample[0].name).toBe('Kate Anderson');
    });
  });
});
