const dbConnection = require('../config/database');

class CommunicationLogModel {
  constructor() {
    this.collection = null;
  }

  getCollection() {
    if (!this.collection) {
      this.collection = dbConnection.getDb().collection('communication_logs');
    }
    return this.collection;
  }

  /**
   * Create a new communication log
   * @param {Object} logData
   * @param {string} logData._id - UUID-style ID
   * @param {string} logData.campaign_id
   * @param {string} logData.lead_id
   * @param {string} logData.status
   * @param {number} logData.attempt
   * @param {Date} logData.created_at
   */
  async create(logData) {
    const log = {
      _id: logData._id,
      campaign_id: logData.campaign_id,
      lead_id: logData.lead_id,
      status: logData.status || 'PENDING',
      attempt: logData.attempt || 0,
      error: logData.error || null,
      created_at: logData.created_at || new Date(),
      updated_at: new Date()
    };

    await this.getCollection().insertOne(log);
    return log;
  }

  /**
   * Update status of a communication log by UUID _id
   * @param {string} logId
   * @param {string} status
   * @param {string} [error] Optional error message
   */
  async updateStatus(logId, status, error = null) {
    const update = {
      status,
      updated_at: new Date()
    };
    if (error) update.error = error;

    return await this.getCollection().updateOne(
      { _id: logId },
      { $set: update }
    );
  }

  /**
   * Find logs by filter
   * @param {Object} filter
   */
  async find(filter) {
    return await this.getCollection().find(filter).toArray();
  }

  /**
   * Find a single log by UUID _id
   * @param {string} logId
   */
  async findById(logId) {
    return await this.getCollection().findOne({ _id: logId });
  }
}

module.exports = new CommunicationLogModel();
