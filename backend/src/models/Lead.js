const { ObjectId } = require('mongodb');
const dbConnection = require('../config/database');

class LeadModel {
  constructor() {
    this.collection = null;
  }

  getCollection() {
    if (!this.collection) {
      this.collection = dbConnection.getDb().collection('leads');
    }
    return this.collection;
  }

  async create(leadData) {
    const lead = {
      name: leadData.name,
      emails: leadData.emails || [],
      phones: leadData.phones || [],
      total_spend: leadData.total_spend || 0,
      visits: leadData.visits || 0,
      last_order_at: leadData.last_order_at || null,
      metadata: leadData.metadata || {},
      created_at: new Date()
    };

    const result = await this.getCollection().insertOne(lead);
    return { ...lead, _id: result.insertedId };
  }

  async bulkUpsert(leads) {
    const bulkOps = leads.map(lead => {
      const filter = { emails: { $in: lead.emails } };

      const update = {
        $set: {
          name: lead.name,
          emails: lead.emails || [],
          phones: lead.phones || [],
          total_spend: lead.total_spend || 0,
          visits: lead.visits || 0,
          last_order_at: lead.last_order_at || null,
          metadata: lead.metadata || {},
          updated_at: new Date()
        },
        $setOnInsert: { created_at: new Date() }
      };

      return { updateOne: { filter, update, upsert: true } };
    });

    const result = await this.getCollection().bulkWrite(bulkOps, { ordered: false });

    return {
      inserted: result.upsertedCount,
      modified: result.modifiedCount,
      matched: result.matchedCount
    };
  }

  async findById(id) {
    return await this.getCollection().findOne({ _id: new ObjectId(id) });
  }

  async findByEmails(emails) {
    return await this.getCollection().find({ emails: { $in: emails } }).toArray();
  }

  async findByPhones(phones) {
    return await this.getCollection().find({ phones: { $in: phones } }).toArray();
  }

  // ✅ Added generic find method
  async find(query) {
    return await this.getCollection().find(query).toArray();
  }

  async findMany(query, options = {}) {
    const { limit = 10, skip = 0, sort = {} } = options;
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

  async updateSpend(leadId, amount) {
    return await this.getCollection().updateOne(
      { _id: new ObjectId(leadId) },
      {
        $inc: { total_spend: amount },
        $set: { last_order_at: new Date(), updated_at: new Date() }
      }
    );
  }

  async incrementVisits(leadId) {
    return await this.getCollection().updateOne(
      { _id: new ObjectId(leadId) },
      {
        $inc: { visits: 1 },
        $set: { updated_at: new Date() }
      }
    );
  }
}

module.exports = new LeadModel();
