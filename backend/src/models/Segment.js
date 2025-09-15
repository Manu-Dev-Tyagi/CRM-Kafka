const { ObjectId } = require('mongodb');
const dbConnection = require('../config/database');

class SegmentModel {
  constructor() {
    this.collection = null;
  }

  getCollection() {
    if (!this.collection) {
      this.collection = dbConnection.getDb().collection('segments');
    }
    return this.collection;
  }

  // ✅ Create segment with rule_ast persisted
  async create(segmentData) {
    if (!segmentData.rule_ast || typeof segmentData.rule_ast !== 'object') {
      throw new Error('rule_ast is required and must be an object');
    }

    const segment = {
      name: segmentData.name,
      owner_user_id: segmentData.owner_user_id,
      rule_ast: segmentData.rule_ast,
      last_preview_count: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await this.getCollection().insertOne(segment);
    return { ...segment, _id: result.insertedId };
  }

  async findById(id) {
    return await this.getCollection().findOne({ _id: new ObjectId(id) });
  }

  async findByOwner(ownerId) {
    return await this.getCollection()
      .find({ owner_user_id: ownerId })
      .sort({ created_at: -1 })
      .toArray();
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

  async updatePreviewCount(segmentId, count) {
    return await this.getCollection().updateOne(
      { _id: new ObjectId(segmentId) },
      {
        $set: {
          last_preview_count: count,
          updated_at: new Date()
        }
      }
    );
  }

  async update(segmentId, updateData) {
    if (updateData.rule_ast && typeof updateData.rule_ast !== 'object') {
      throw new Error('rule_ast must be an object');
    }

    return await this.getCollection().updateOne(
      { _id: new ObjectId(segmentId) },
      {
        $set: {
          ...updateData,
          updated_at: new Date()
        }
      }
    );
  }

  async delete(segmentId) {
    return await this.getCollection().deleteOne({ _id: new ObjectId(segmentId) });
  }

  async count(query = {}) {
    return await this.getCollection().countDocuments(query);
  }
}

module.exports = new SegmentModel();
