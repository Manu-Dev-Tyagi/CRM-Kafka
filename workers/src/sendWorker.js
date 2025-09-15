const { Kafka } = require('kafkajs');
const path = require('path');
const dbConnection = require(path.resolve(__dirname, '../../backend/src/config/database'));
const CommunicationLogModel = require(path.resolve(__dirname, '../../backend/src/models/CommunicationLog'));
const WhatsAppConnectionManager = require('../services/WhatsAppConnectionManager');

class SendWorker {
    constructor() {
        this.kafka = null;
        this.consumer = null;
        this.producer = null;
        this.whatsapp = null;
        this.connected = false;
        this.consumerRunning = false;
        this.stats = {
            processed: 0,
            sent: 0,
            failed: 0,
            queued: 0,
            startTime: Date.now()
        };

        // Rate limiting
        this.messagesSentInCurrentMinute = 0;
        this.maxMessagesPerMinute = parseInt(process.env.MAX_MESSAGES_PER_MINUTE) || 30;
        this.rateLimitReset = Date.now() + 60000;

        // Retry configuration
        this.maxRetryAttempts = parseInt(process.env.MAX_SEND_ATTEMPTS) || 3;
        this.retryDelay = 2000; // 2 seconds initial delay

        this.isInitialized = false;
        this.isShuttingDown = false;
    }

    async initialize(config) {
        if (this.isInitialized) {
            console.log('⚠️ SendWorker already initialized');
            return;
        }

        console.log('🔧 Initializing Send Worker...');

        try {
            // Initialize Kafka
            await this.initializeKafka(config);

            // Initialize MongoDB
            await this.initializeDatabase();

            // Initialize WhatsApp
            await this.initializeWhatsApp();

            this.isInitialized = true;
            console.log('✅ Send Worker initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Send Worker:', error);
            throw error;
        }
    }

    async initializeKafka(config) {
        console.log('🔧 Setting up Kafka connection...');

        this.kafka = new Kafka({
            clientId: config.clientId || 'send-worker',
            brokers: config.brokers || ['localhost:19092'],
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
            groupId: config.groupId || 'send-worker-group',
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
            topic: 'campaign.send_jobs',
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

    async initializeWhatsApp() {
        console.log('🔧 Initializing WhatsApp connection...');

        this.whatsapp = new WhatsAppConnectionManager({
            maxReconnectAttempts: 10,
            reconnectDelay: 5000,
            concurrency: parseInt(process.env.SEND_CONCURRENCY) || 5
        });

        // Set up event listeners
        this.whatsapp.on('connected', (socket) => {
            this.connected = true;
            console.log('✅ WhatsApp connected in SendWorker');
            this.stats.queued = this.whatsapp.messageQueue.length;
        });

        this.whatsapp.on('disconnected', (reason, message) => {
            this.connected = false;
            console.log(`⚠️ WhatsApp disconnected in SendWorker: ${message}`);
        });

        this.whatsapp.on('qr', (qr) => {
            console.log('📱 New QR code generated, please scan with WhatsApp');
        });

        this.whatsapp.on('error', (error) => {
            console.error('❌ WhatsApp connection error:', error.message);
        });

        this.whatsapp.on('maxReconnectAttemptsReached', () => {
            console.error('❌ Max WhatsApp reconnection attempts reached');
        });

        // Start connection
        await this.whatsapp.connect();

        console.log('✅ WhatsApp connection manager initialized');
    }

    async start() {
        if (!this.isInitialized) {
            throw new Error('SendWorker not initialized. Call initialize() first.');
        }

        if (this.consumerRunning) {
            console.log('⚠️ Consumer already running');
            return;
        }

        console.log('🚀 Starting Send Worker consumer...');
        this.consumerRunning = true;

        // Start rate limit reset timer
        this.startRateLimitTimer();

        await this.consumer.run({
            eachMessage: async ({ topic, partition, message, heartbeat }) => {
                try {
                    await this.processMessage(message);
                    await heartbeat();
                } catch (error) {
                    console.error('❌ Error processing message:', error);
                    this.stats.failed++;
                    // Don't throw here to avoid crashing the consumer
                }
            },
            eachBatchAutoResolve: true,
            partitionsConsumedConcurrently: 1
        });
    }

    async processMessage(message) {
        let job;
        try {
            job = JSON.parse(message.value.toString());
        } catch (error) {
            console.warn('⚠️ Invalid JSON message, skipping');
            return;
        }

        const { send_id, campaign_id, lead_id, to, message: text, attempt = 1 } = job;

        if (!send_id || !to || !text) {
            console.warn('⚠️ Invalid job format, missing required fields:', { send_id, to, text });
            await this.updateCommunicationLog(send_id, 'FAILED', 'Missing required fields');
            this.stats.failed++;
            return;
        }

        this.stats.processed++;
        console.log(`📨 Processing message for ${to} (attempt ${attempt})`);

        // Check rate limiting
        if (!this.checkRateLimit()) {
            console.log(`⏳ Rate limit reached, queuing message for ${to}`);
            await this.requeueMessage(job, 'Rate limit exceeded');
            return;
        }

        try {
            await this.sendMessage(job);
        } catch (error) {
            console.error(`❌ Failed to send message to ${to}:`, error.message);
            await this.handleSendFailure(job, error);
        }
    }

    async sendMessage(job) {
        const { send_id, campaign_id, lead_id, to, message: text, attempt } = job;

        // Check if WhatsApp is connected
        if (!this.whatsapp.isConnected()) {
            throw new Error('WhatsApp not connected');
        }

        // Send message via WhatsApp
        const result = await this.whatsapp.sendMessage(to, text);

        // Update communication log
        await this.updateCommunicationLog(send_id, 'SENT');

        // Send status update to Kafka
        await this.sendStatusUpdate({
            send_id,
            campaign_id,
            lead_id,
            status: 'SENT',
            attempt,
            timestamp: new Date().toISOString()
        });

        this.stats.sent++;
        this.messagesSentInCurrentMinute++;

        console.log(`✅ Message sent to ${to} (send_id: ${send_id})`);
        return result;
    }

    async handleSendFailure(job, error) {
        const { send_id, campaign_id, lead_id, to, attempt } = job;

        // Check if we should retry
        if (attempt < this.maxRetryAttempts) {
            console.log(`🔄 Retrying message to ${to} (attempt ${attempt + 1}/${this.maxRetryAttempts})`);
            await this.requeueMessage({
                ...job,
                attempt: attempt + 1
            }, error.message);
            return;
        }

        // Max retries reached, mark as failed
        await this.updateCommunicationLog(send_id, 'FAILED', error.message);

        await this.sendStatusUpdate({
            send_id,
            campaign_id,
            lead_id,
            status: 'FAILED',
            attempt,
            error: error.message,
            timestamp: new Date().toISOString()
        });

        this.stats.failed++;
    }

    async requeueMessage(job, reason) {
        const delay = this.retryDelay * Math.pow(2, (job.attempt || 1) - 1); // Exponential backoff

        setTimeout(async () => {
            try {
                await this.producer.send({
                    topic: 'campaign.send_jobs',
                    messages: [{
                        key: job.lead_id?.toString() || job.send_id,
                        value: JSON.stringify(job)
                    }]
                });
                console.log(`🔄 Requeued message for ${job.to} after ${delay}ms delay`);
            } catch (error) {
                console.error('❌ Failed to requeue message:', error.message);
                // Mark as failed if we can't requeue
                await this.updateCommunicationLog(job.send_id, 'FAILED', `Failed to requeue: ${error.message}`);
                this.stats.failed++;
            }
        }, delay);
    }

    async updateCommunicationLog(sendId, status, error = null) {
        try {
            await CommunicationLogModel.updateStatus(sendId, status, error);
        } catch (dbError) {
            console.error(`❌ Failed to update communication log for ${sendId}:`, dbError.message);
            // Don't throw here as it would break message processing
        }
    }

    async sendStatusUpdate(statusData) {
        try {
            await this.producer.send({
                topic: 'campaign.status_updates',
                messages: [{
                    key: statusData.send_id,
                    value: JSON.stringify(statusData)
                }]
            });
        } catch (error) {
            console.error('❌ Failed to send status update:', error.message);
            // Don't throw here as the main message was sent successfully
        }
    }

    checkRateLimit() {
        const now = Date.now();

        // Reset counter if minute has passed
        if (now >= this.rateLimitReset) {
            this.messagesSentInCurrentMinute = 0;
            this.rateLimitReset = now + 60000;
        }

        return this.messagesSentInCurrentMinute < this.maxMessagesPerMinute;
    }

    startRateLimitTimer() {
        setInterval(() => {
            this.messagesSentInCurrentMinute = 0;
            console.log(`🔄 Rate limit reset - can send ${this.maxMessagesPerMinute} messages this minute`);
        }, 60000);
    }

    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const whatsappInfo = this.whatsapp ? this.whatsapp.getConnectionInfo() : {};

        return {
            worker: 'send-worker',
            ...this.stats,
            uptime: Math.floor(uptime / 1000),
            connected: this.connected,
            consumerRunning: this.consumerRunning,
            rateLimitInfo: {
                sentThisMinute: this.messagesSentInCurrentMinute,
                maxPerMinute: this.maxMessagesPerMinute,
                resetIn: Math.max(0, this.rateLimitReset - Date.now())
            },
            whatsapp: whatsappInfo
        };
    }

    async stop() {
        console.log('🛑 Stopping Send Worker...');
        this.isShuttingDown = true;
        this.consumerRunning = false;

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

        // Disconnect WhatsApp
        if (this.whatsapp) {
            shutdownPromises.push(
                this.whatsapp.disconnect().catch(err =>
                    console.warn('⚠️ Error disconnecting WhatsApp:', err.message)
                )
            );
        }

        // Wait for all disconnections
        await Promise.allSettled(shutdownPromises);

        console.log('✅ Send Worker stopped gracefully');
    }
}

module.exports = new SendWorker();