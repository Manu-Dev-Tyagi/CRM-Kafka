const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const dbConnection = require('../backend/src/config/database');
const jobExpanderWorker = require('./src/jobExpander');
const sendWorker = require('./src/sendWorker');
const statusAggregatorWorker = require('./aggregators/statusAggregator');

console.log('🚀 Mini CRM Workers starting...');
console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Kafka Brokers: ${process.env.KAFKA_BROKERS || 'localhost:19092'}`);
console.log(`💾 MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/mini_crm'}`);

class WorkerManager {
    constructor() {
        this.workers = [];
        this.isShuttingDown = false;
        this.startTime = Date.now();
        this.healthServer = null;

        // Setup graceful shutdown handlers
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            this.gracefulShutdown('UNCAUGHT_EXCEPTION');
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            // Don't exit on unhandled rejections, just log them
        });
    }

    async start() {
        try {
            console.log('🔧 Initializing database connection...');
            await this.initializeDatabase();

            console.log('🔧 Preparing Kafka configuration...');
            const kafkaConfig = this.getKafkaConfig();

            console.log('🔧 Starting workers...');
            await this.startWorkers(kafkaConfig);

            console.log('🔧 Starting health server...');
            await this.startHealthServer();

            console.log('🔧 Starting monitoring...');
            this.startMonitoring();

            console.log('✅ All workers started successfully!');
            console.log('━'.repeat(50));
            console.log('📊 Worker Status:');
            console.log(`   🔄 Job Expander: ${jobExpanderWorker.getStats().isRunning ? 'RUNNING' : 'STOPPED'}`);
            console.log(`   📤 Send Worker: ${sendWorker.connected ? 'CONNECTED' : 'DISCONNECTED'}`);
            console.log(`   📈 Status Aggregator: RUNNING`);
            console.log(`   🏥 Health Server: http://localhost:${process.env.WORKER_PORT || 3003}`);
            console.log('━'.repeat(50));

        } catch (error) {
            console.error('❌ Failed to start workers:', error);
            process.exit(1);
        }
    }

    async initializeDatabase() {
        if (dbConnection.isConnected()) {
            console.log('✅ Database already connected');
            return;
        }

        await dbConnection.connect({
            uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mini_crm',
            dbName: process.env.MONGODB_DB_NAME || 'mini_crm'
        });

        console.log('✅ Database connection established');
    }

    getKafkaConfig() {
        const brokers = (process.env.KAFKA_BROKERS || 'localhost:19092').split(',').map(b => b.trim());
        const instanceId = process.env.WORKER_INSTANCE_ID || `worker-${Date.now()}`;
        return {
            brokers,
            clientId: (process.env.KAFKA_CLIENT_ID || 'mini-crm-workers') + `-${instanceId}`,
            instanceId
        };
    }

    async startWorkers(kafkaConfig) {
        // Start Job Expander Worker
        console.log('🔄 Initializing Job Expander Worker...');
        try {
            await jobExpanderWorker.initialize({
                ...kafkaConfig,
                groupId: (process.env.KAFKA_GROUP_ID || 'mini-crm-workers-group') + '-expander-' + kafkaConfig.instanceId
            });
            await jobExpanderWorker.start();
            this.workers.push({ name: 'JobExpander', instance: jobExpanderWorker });
            console.log('✅ Job Expander Worker started');
        } catch (error) {
            console.error('❌ Failed to start Job Expander Worker:', error);
            throw error;
        }

        // Start Send Worker
        console.log('📤 Initializing Send Worker...');
        try {
            await sendWorker.initialize({
                ...kafkaConfig,
                groupId: (process.env.KAFKA_GROUP_ID || 'mini-crm-workers-group') + '-send-' + kafkaConfig.instanceId
            });

            // Wait for WhatsApp connection with timeout
            console.log('📱 Waiting for WhatsApp connection...');
            await this.waitForWhatsAppConnection(120000); // 2 minutes timeout

            await sendWorker.start();
            this.workers.push({ name: 'SendWorker', instance: sendWorker });
            console.log('✅ Send Worker started');
        } catch (error) {
            console.error('❌ Failed to start Send Worker:', error);
            throw error;
        }

        // Start Status Aggregator Worker
        console.log('📈 Initializing Status Aggregator Worker...');
        try {
            await statusAggregatorWorker.initialize({
                ...kafkaConfig,
                groupId: (process.env.KAFKA_GROUP_ID || 'mini-crm-workers-group') + '-aggregator-' + kafkaConfig.instanceId
            });
            await statusAggregatorWorker.start();
            this.workers.push({ name: 'StatusAggregator', instance: statusAggregatorWorker });
            console.log('✅ Status Aggregator Worker started');
        } catch (error) {
            console.error('❌ Failed to start Status Aggregator Worker:', error);
            throw error;
        }
    }

    async waitForWhatsAppConnection(timeout = 120000) {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every second

        while (Date.now() - startTime < timeout) {
            if (sendWorker.connected) {
                console.log('✅ WhatsApp connected successfully');
                return;
            }

            console.log('⏳ Waiting for WhatsApp connection...');
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        // Don't throw error, just warn - SendWorker can queue messages
        console.warn('⚠️ WhatsApp connection timeout - messages will be queued until connected');
    }

    async startHealthServer() {
        const app = express();
        const port = process.env.WORKER_PORT || 3003;

        app.use(express.json());

        // Health check endpoint
        app.get('/health', (req, res) => {
            try {
                const health = this.getHealthStatus();
                const status = health.overall === 'healthy' ? 200 : 503;
                res.status(status).json(health);
            } catch (error) {
                res.status(500).json({
                    overall: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Detailed stats endpoint
        app.get('/stats', (req, res) => {
            try {
                const stats = this.getAllStats();
                res.json(stats);
            } catch (error) {
                res.status(500).json({
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // WhatsApp status endpoint
        app.get('/whatsapp', (req, res) => {
            try {
                const whatsappStats = sendWorker.getStats();
                res.json({
                    connected: sendWorker.connected,
                    whatsapp: whatsappStats.whatsapp || {},
                    rateLimitInfo: whatsappStats.rateLimitInfo || {},
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Worker control endpoints
        app.post('/restart/:worker', async (req, res) => {
            const workerName = req.params.worker;
            try {
                await this.restartWorker(workerName);
                res.json({
                    success: true,
                    message: `${workerName} restarted successfully`,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        return new Promise((resolve) => {
            this.healthServer = app.listen(port, '0.0.0.0', () => {
                console.log(`🏥 Health server running on port ${port}`);
                resolve();
            });
        });
    }

    getHealthStatus() {
        const workers = {};
        let overallHealthy = true;

        // Check each worker
        for (const worker of this.workers) {
            try {
                const stats = worker.instance.getStats();
                workers[worker.name] = {
                    status: stats.isRunning !== false ? 'healthy' : 'unhealthy',
                    ...stats
                };

                if (stats.isRunning === false) {
                    overallHealthy = false;
                }
            } catch (error) {
                workers[worker.name] = {
                    status: 'unhealthy',
                    error: error.message
                };
                overallHealthy = false;
            }
        }

        // Check database
        const database = {
            status: dbConnection.isConnected() ? 'healthy' : 'unhealthy'
        };
        if (!dbConnection.isConnected()) {
            overallHealthy = false;
        }

        return {
            overall: overallHealthy ? 'healthy' : 'unhealthy',
            database,
            workers,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            timestamp: new Date().toISOString()
        };
    }

    getAllStats() {
        const stats = {
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            workers: {},
            timestamp: new Date().toISOString()
        };

        for (const worker of this.workers) {
            try {
                stats.workers[worker.name] = worker.instance.getStats();
            } catch (error) {
                stats.workers[worker.name] = {
                    error: error.message
                };
            }
        }

        return stats;
    }

    async restartWorker(workerName) {
        const worker = this.workers.find(w => w.name.toLowerCase() === workerName.toLowerCase());
        if (!worker) {
            throw new Error(`Worker ${workerName} not found`);
        }

        console.log(`🔄 Restarting worker: ${worker.name}`);

        // Stop the worker
        await worker.instance.stop();

        // Reinitialize and start
        const kafkaConfig = this.getKafkaConfig();

        if (worker.name === 'JobExpander') {
            await worker.instance.initialize({
                ...kafkaConfig,
                groupId: (process.env.KAFKA_GROUP_ID || 'mini-crm-workers-group') + '-expander-' + kafkaConfig.instanceId
            });
        } else if (worker.name === 'SendWorker') {
            await worker.instance.initialize({
                ...kafkaConfig,
                groupId: (process.env.KAFKA_GROUP_ID || 'mini-crm-workers-group') + '-send-' + kafkaConfig.instanceId
            });
        } else if (worker.name === 'StatusAggregator') {
            await worker.instance.initialize({
                ...kafkaConfig,
                groupId: (process.env.KAFKA_GROUP_ID || 'mini-crm-workers-group') + '-aggregator-' + kafkaConfig.instanceId
            });
        }

        await worker.instance.start();
        console.log(`✅ Worker ${worker.name} restarted successfully`);
    }

    startMonitoring() {
        // Log stats every 60 seconds
        setInterval(() => {
            if (this.isShuttingDown) return;

            console.log('\n📊 Worker Stats:');
            for (const worker of this.workers) {
                try {
                    const stats = worker.instance.getStats();
                    if (worker.name === 'JobExpander') {
                        console.log(`   🔄 ${worker.name}: Jobs=${stats.processedJobs}, Leads=${stats.processedLeads}, Errors=${stats.errors}`);
                    } else if (worker.name === 'SendWorker') {
                        console.log(`   📤 ${worker.name}: Processed=${stats.processed}, Sent=${stats.sent}, Failed=${stats.failed}, Connected=${sendWorker.connected}`);
                    } else {
                        console.log(`   📈 ${worker.name}: Processed=${stats.processed || 0}, Errors=${stats.errors || 0}`);
                    }
                } catch (error) {
                    console.log(`   ❌ ${worker.name}: Error getting stats - ${error.message}`);
                }
            }
            console.log(`   ⏱️ Uptime: ${Math.floor((Date.now() - this.startTime) / 1000)}s`);
        }, 60000);

        // Health check every 30 seconds
        setInterval(() => {
            if (this.isShuttingDown) return;

            const health = this.getHealthStatus();
            if (health.overall !== 'healthy') {
                console.warn(`⚠️ Health check failed: ${JSON.stringify(health, null, 2)}`);
            }
        }, 30000);
    }

    async gracefulShutdown(signal) {
        if (this.isShuttingDown) return;

        console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
        this.isShuttingDown = true;

        const shutdownPromises = [];

        // Stop health server
        if (this.healthServer) {
            shutdownPromises.push(
                new Promise((resolve) => {
                    this.healthServer.close(() => {
                        console.log('✅ Health server stopped');
                        resolve();
                    });
                })
            );
        }

        // Stop all workers
        for (const worker of this.workers) {
            console.log(`🛑 Stopping ${worker.name}...`);
            shutdownPromises.push(
                worker.instance.stop().catch(error =>
                    console.warn(`⚠️ Error stopping ${worker.name}:`, error.message)
                )
            );
        }

        // Disconnect database
        shutdownPromises.push(
            dbConnection.disconnect().catch(error =>
                console.warn('⚠️ Error disconnecting database:', error.message)
            )
        );

        // Wait for all shutdowns to complete
        await Promise.allSettled(shutdownPromises);

        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    }
}

// Start the worker manager
const manager = new WorkerManager();
manager.start().catch((error) => {
    console.error('💥 Fatal error starting workers:', error);
    process.exit(1);
});