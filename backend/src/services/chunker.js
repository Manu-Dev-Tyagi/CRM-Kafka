const { v4: uuidv4 } = require('uuid');

class ChunkerService {
  constructor() {
    this.defaultChunkSize = parseInt(process.env.CHUNK_SIZE) || 100;
    this.maxChunkSize = parseInt(process.env.MAX_CHUNK_SIZE) || 200;
  }

  chunkLeadIds(leadIds, chunkSize = null) {
    if (!Array.isArray(leadIds)) {
      throw new Error('leadIds must be an array');
    }

    if (leadIds.length === 0) {
      console.warn('⚠️ chunkLeadIds called with empty leadIds array');
      return [];
    }

    const size = chunkSize || this.defaultChunkSize;

    if (size <= 0 || size > this.maxChunkSize) {
      throw new Error(`Chunk size must be >0 and <= ${this.maxChunkSize}`);
    }

    const chunks = [];
    for (let i = 0; i < leadIds.length; i += size) {
      const chunk = leadIds.slice(i, i + size);
      chunks.push(chunk);
      console.log(`📦 Created chunk ${chunks.length} with ${chunk.length} leads:`, chunk);
    }

    return chunks;
  }

  createChunkMessages(campaignId, leadIds, chunkSize = null) {
    if (!campaignId) throw new Error('campaignId is required');
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      console.warn('⚠️ createChunkMessages called with empty leadIds array');
      return [];
    }

    const chunks = this.chunkLeadIds(leadIds, chunkSize);
    const messages = chunks.map((chunk, index) => {
      const jobId = this.generateJobId(campaignId, index);
      console.log(`🔹 Chunk ${index + 1} -> Job ID: ${jobId}, Lead IDs:`, chunk);
      return {
        jobId,                        // ✅ camelCase
        campaignId,                   // ✅ camelCase
        leadIds: chunk,               // ✅ camelCase
        createdAt: new Date().toISOString()
      };
    });

    console.log(`✅ Total chunks created: ${messages.length}`);
    return messages;
  }

  generateJobId(campaignId, chunkIndex) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    return `job-${campaignId}-${chunkIndex}-${timestamp}-${randomSuffix}`;
  }
}

module.exports = new ChunkerService();
