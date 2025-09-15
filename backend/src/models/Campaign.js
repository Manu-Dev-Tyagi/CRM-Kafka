const { ObjectId } = require('mongodb');
const dbConnection = require('../config/database');

const CAMPAIGN_STATUSES = {
  DRAFT: 'DRAFT',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED'
};

class CampaignModel {
  constructor() {
    this.collection = null;
  }

  getCollection() {
    if (!this.collection) {
      this.collection = dbConnection.getDb().collection('campaigns');
    }
    return this.collection;
  }

  async create(campaignData) {
    const campaign = {
      name: campaignData.name,
      segment_id: new ObjectId(campaignData.segment_id),
      message_template: campaignData.message_template,
      created_by: campaignData.created_by,
      status: CAMPAIGN_STATUSES.DRAFT,
      stats: {
        audience: campaignData.audience,
        sent: 0,
        failed: 0,
        delivered: 0
      },
      created_at: new Date()
    };

    const result = await this.getCollection().insertOne(campaign);
    return { ...campaign, _id: result.insertedId };
  }

  async findById(id) {
    return await this.getCollection().findOne({ _id: new ObjectId(id) });
  }

  async getCampaignWithStats(id) {
    try {
      const objectId = new ObjectId(id);

      const pipeline = [
        {
          $match: { _id: objectId }
        },
        {
          $lookup: {
            from: 'communication_logs',
            let: { campaignId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ['$campaign_id', '$$campaignId'] }, // if stored as ObjectId
                      { $eq: ['$campaign_id', { $toString: '$$campaignId' }] } // if stored as string
                    ]
                  }
                }
              }
            ],
            as: 'logs'
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            segment_id: 1,
            message_template: 1,
            created_by: 1,
            status: 1,
            created_at: 1,
            updated_at: 1,
            'stats.audience': '$stats.audience',
            'stats.sent': {
              $size: {
                $filter: {
                  input: '$logs',
                  as: 'log',
                  cond: { $ne: ['$$log.status', null] }
                }
              }
            },
            'stats.delivered': {
              $size: {
                $filter: {
                  input: '$logs',
                  as: 'log',
                  cond: { $eq: ['$$log.status', 'delivered'] }
                }
              }
            },
            'stats.failed': {
              $size: {
                $filter: {
                  input: '$logs',
                  as: 'log',
                  cond: { $eq: ['$$log.status', 'failed'] }
                }
              }
            }
          }
        }
      ];

      const result = await this.getCollection().aggregate(pipeline).toArray();
      return result[0] || null;
    } catch (err) {
      console.error('getCampaignWithStats error:', err);
      throw err;
    }
  }

  async findMany(query, options = {}) {
    const { limit = 10, skip = 0, sort = { created_at: -1 } } = options;
    return await this.getCollection()
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async count(query = {}) {
    return await this.getCollection().countDocuments(query);
  }

  async updateStatus(campaignId, status) {
    if (!Object.values(CAMPAIGN_STATUSES).includes(status.toUpperCase())) {
      throw new Error(`Invalid status: ${status}`);
    }

    return await this.getCollection().updateOne(
      { _id: new ObjectId(campaignId) },
      {
        $set: {
          status: status.toUpperCase(),
          updated_at: new Date()
        }
      }
    );
  }
}

module.exports = new CampaignModel();
