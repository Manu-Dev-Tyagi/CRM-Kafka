const { Kafka } = require('kafkajs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbConnection = require(path.resolve(__dirname, '../../backend/src/config/database'));
const CampaignModel = require(path.resolve(__dirname, '../../backend/src/models/Campaign'));
const LeadModel = require(path.resolve(__dirname, '../../backend/src/models/Lead'));
const CommunicationLogModel = require(path.resolve(__dirname, '../../backend/src/models/CommunicationLog'));
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');

class JobExpanderWorker {
  constructor() {
    this.kafka = null;
    this.consumer = null;
    this.producer = null;
    this.stats = {
      processedJobs: 0,
      processedLeads: 0,
      errors: 0,
      startTime: Date.now()
    };
    this.isRunning = false;
    this.isInitialized = false;
    this.isShuttingDown = false;

    // Processing configuration
    this.maxLeadsPerJob = parseInt(process.env.MAX_LEADS_PER_JOB) || 1000;
    this.batchSize = parseInt(process.env.LEAD_BATCH_SIZE) || 100;
  }

  async initialize(config) {
    if (this.isInitialized) {
      console.log('⚠️ JobExpanderWorker already initialized');
      return;
    }

    console.log('🔧 Initializing Job Expander Worker...');

    try {
      // Initialize Kafka
      await this.initializeKafka(config);

      // Initialize Database
      await this.initializeDatabase();

      this.isInitialized = true;
      console.log('✅ Job Expander Worker initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Job Expander Worker:', error);
      throw error;
    }
  }

  async initializeKafka(config) {
    console.log('🔧 Setting up Kafka connection...');

    this.kafka = new Kafka({
      clientId: config?.clientId || 'job-expander',
      brokers: config?.brokers || [process.env.KAFKA_BROKERS || 'localhost:19092'],
      retry: {
        initialRetryTime: 100,
        retries: 8,
        factor: 2,
        multiplier: 2,
        maxRetryTime: 30000
      },
      connectionTimeout: 10000,
      requestTimeout: 30000
    });

    this.consumer = this.kafka.consumer({
      groupId: config?.groupId || 'job-expander-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 5000,
      allowAutoTopicCreation: true
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    await this.consumer.connect();
    await this.producer.connect();
    await this.consumer.subscribe({
      topic: 'campaign.jobs',
      fromBeginning: false
    });

    console.log('✅ Kafka connection established');
  }

  async initializeDatabase() {
    console.log('🔧 Connecting to MongoDB...');

    if (!dbConnection.isConnected()) {
      await dbConnection.connect({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mini_crm',
        dbName: process.env.MONGODB_DB_NAME || 'mini_crm'
      });
    }

    console.log('✅ Database connection established');
  }

  async start() {
    if (!this.isInitialized) {
      throw new Error('JobExpanderWorker not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      console.log('⚠️ Job Expander Worker already running');
      return;
    }

    console.log('🚀 Starting Job Expander Worker...');
    this.isRunning = true;

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message, heartbeat }) => {
        try {
          console.log('\n━━━ New Campaign Job Received ━━━');
          await this.processJob(message);
          await heartbeat();
        } catch (error) {
          this.stats.errors++;
          console.error('❌ Error processing job:', error);
          // Log error details but don't crash the consumer
        }
      },
      eachBatchAutoResolve: true,
      partitionsConsumedConcurrently: 1
    });
  }

  async processJob(message) {
    let job;
    try {
      const rawMessage = message.value.toString();
      console.log(`📥 Raw message: ${rawMessage}`);
      job = JSON.parse(rawMessage);
      console.log(`📊 Parsed job:`, job);
    } catch (error) {
      console.warn('⚠️ Invalid job format, skipping:', error.message);
      return;
    }

    // Validate job structure
    if (!this.validateJob(job)) {
      return;
    }

    try {
      // Fetch campaign details
      const campaign = await this.fetchCampaign(job.campaignId);
      if (!campaign) return;

      // Process leads in batches
      await this.processLeads(campaign, job.leadIds);

      this.stats.processedJobs++;
      console.log(`✅ Job processing completed for campaign ${campaign._id}`);

    } catch (error) {
      console.error(`❌ Job processing failed:`, error);
      this.stats.errors++;
      // Could implement retry logic or DLQ here
    }
  }

  validateJob(job) {
    if (!job || typeof job !== 'object') {
      console.warn('⚠️ Invalid job: not an object');
      return false;
    }

    if (!job.campaignId) {
      console.warn('⚠️ Invalid job: missing campaignId');
      return false;
    }

    if (!Array.isArray(job.leadIds)) {
      console.warn('⚠️ Invalid job: leadIds is not an array');
      return false;
    }

    if (job.leadIds.length === 0) {
      console.warn('⚠️ Invalid job: empty leadIds array');
      return false;
    }

    if (job.leadIds.length > this.maxLeadsPerJob) {
      console.warn(`⚠️ Job too large: ${job.leadIds.length} leads exceeds limit of ${this.maxLeadsPerJob}`);
      return false;
    }

    return true;
  }

  async fetchCampaign(campaignId) {
    try {
      const campaign = await CampaignModel.findById(campaignId);
      if (!campaign) {
        console.warn(`⚠️ Campaign not found: ${campaignId}`);
        return null;
      }

      console.log(`📋 Campaign loaded: ${campaign._id} - "${campaign.name}"`);
      console.log(`📝 Message template: "${campaign.message_template}"`);

      return campaign;
    } catch (error) {
      console.error(`❌ Error fetching campaign ${campaignId}:`, error.message);
      throw error;
    }
  }

  async processLeads(campaign, leadIds) {
    console.log(`👥 Processing ${leadIds.length} leads for campaign ${campaign._id}`);

    // Normalize lead IDs to ObjectId format
    const normalizedIds = this.normalizeLeadIds(leadIds);
    if (normalizedIds.length === 0) {
      console.warn('⚠️ No valid lead IDs after normalization, skipping job');
      return;
    }

    // Process leads in batches to avoid memory issues
    const totalBatches = Math.ceil(normalizedIds.length / this.batchSize);
    let processedCount = 0;

    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * this.batchSize;
      const batchEnd = Math.min(batchStart + this.batchSize, normalizedIds.length);
      const batchIds = normalizedIds.slice(batchStart, batchEnd);

      console.log(`📦 Processing batch ${i + 1}/${totalBatches} (${batchIds.length} leads)`);

      try {
        const batchCount = await this.processBatch(campaign, batchIds);
        processedCount += batchCount;
      } catch (error) {
        console.error(`❌ Error processing batch ${i + 1}:`, error.message);
        // Continue with next batch instead of failing entire job
      }
    }

    console.log(`✅ Processed ${processedCount}/${leadIds.length} leads for campaign ${campaign._id}`);
    this.stats.processedLeads += processedCount;
  }

  normalizeLeadIds(leadIds) {
    const normalized = [];

    for (const id of leadIds) {
      try {
        const objectId = new ObjectId(id);
        normalized.push(objectId);
      } catch (error) {
        console.warn(`⚠️ Invalid ObjectId: ${id}, skipping`);
      }
    }

    console.log(`🔄 Normalized ${normalized.length}/${leadIds.length} lead IDs`);
    return normalized;
  }

  async processBatch(campaign, leadIds) {
    try {
      // Fetch leads from database
      const leads = await LeadModel.find({ _id: { $in: leadIds } });

      if (leads.length === 0) {
        console.warn(`⚠️ No leads found in DB for batch`);
        return 0;
      }

      console.log(`👥 Found ${leads.length} leads in database`);

      // Create send jobs for each lead
      const sendJobs = [];
      for (const lead of leads) {
        try {
          const sendJob = await this.createSendJob(campaign, lead);
          if (sendJob) {
            sendJobs.push(sendJob);
          }
        } catch (error) {
          console.error(`❌ Failed to create send job for lead ${lead._id}:`, error.message);
          // Continue with other leads
        }
      }

      // Publish send jobs to Kafka in batch
      if (sendJobs.length > 0) {
        await this.publishSendJobs(sendJobs);
      }

      return sendJobs.length;

    } catch (error) {
      console.error(`❌ Error processing lead batch:`, error.message);
      throw error;
    }
  }

  async createSendJob(campaign, lead) {
    const sendId = uuidv4();

    try {
      // Validate lead has phone number
      if (!lead.phones || lead.phones.length === 0) {
        console.warn(`⚠️ Lead ${lead._id} has no phone numbers, skipping`);
        return null;
      }

      // Personalize message template
      const personalizedMessage = this.applyTemplate(campaign.message_template, lead);

      // Create communication log entry
      await CommunicationLogModel.create({
        _id: sendId,
        campaign_id: campaign._id,
        lead_id: lead._id,
        status: 'PENDING',
        attempt: 0,
        created_at: new Date()
      });

      // Create send job
      const sendJob = {
        key: lead._id.toString(),
        value: JSON.stringify({
          send_id: sendId,
          campaign_id: campaign._id.toString(),
          lead_id: lead._id.toString(),
          to: lead.phones[0],
          message: personalizedMessage,
          attempt: 1,
          created_at: new Date().toISOString()
        })
      };

      console.log(`📤 Created send job for ${lead.name} (${lead.phones[0]})`);
      return sendJob;

    } catch (error) {
      console.error(`❌ Failed to create send job for lead ${lead._id}:`, error.message);

      // Clean up communication log if it was created
      try {
        await CommunicationLogModel.updateStatus(sendId, 'FAILED', `Job creation failed: ${error.message}`);
      } catch (cleanupError) {
        console.error(`❌ Failed to update communication log during cleanup:`, cleanupError.message);
      }

      throw error;
    }
  }

  async publishSendJobs(sendJobs) {
    try {
      await this.producer.send({
        topic: 'campaign.send_jobs',
        messages: sendJobs
      });

      console.log(`📤 Published ${sendJobs.length} send jobs to Kafka`);
    } catch (error) {
      console.error(`❌ Failed to publish send jobs:`, error.message);

      // Update communication logs to reflect the failure
      for (const job of sendJobs) {
        try {
          const jobData = JSON.parse(job.value);
          await CommunicationLogModel.updateStatus(
            jobData.send_id,
            'FAILED',
            `Failed to publish to Kafka: ${error.message}`
          );
        } catch (updateError) {
          console.error(`❌ Failed to update communication log:`, updateError.message);
        }
      }

      throw error;
    }
  }

  applyTemplate(template, lead) {
    if (!template) {
      return 'Hello from Mini CRM!'; // Fallback message
    }

    try {
      return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        const value = lead[trimmedKey];

        if (value !== null && value !== undefined) {
          return String(value);
        }

        console.warn(`⚠️ Template variable "${trimmedKey}" not found in lead data`);
        return match; // Keep original placeholder if value not found
      });
    } catch (error) {
      console.error(`❌ Template processing failed:`, error.message);
      return template; // Return original template if processing fails
    }
  }

  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    return {
      worker: 'job-expander',
      ...this.stats,
      isRunning: this.isRunning,
      uptime: Math.floor(uptime / 1000),
      configuration: {
        maxLeadsPerJob: this.maxLeadsPerJob,
        batchSize: this.batchSize
      }
    };
  }

  async stop() {
    console.log('🛑 Stopping Job Expander Worker...');
    this.isShuttingDown = true;
    this.isRunning = false;

    const shutdownPromises = [];

    // Disconnect Kafka components
    if (this.consumer) {
      shutdownPromises.push(
        this.consumer.disconnect().catch(err =>
          console.warn('⚠️ Error disconnecting consumer:', err.message)
        )
      );
    }

    if (this.producer) {
      shutdownPromises.push(
        this.producer.disconnect().catch(err =>
          console.warn('⚠️ Error disconnecting producer:', err.message)
        )
      );
    }

    // Wait for all disconnections
    await Promise.allSettled(shutdownPromises);

    console.log('✅ Job Expander Worker stopped gracefully');
  }
}

module.exports = new JobExpanderWorker();