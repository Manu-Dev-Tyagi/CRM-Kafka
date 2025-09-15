const fastify = require('fastify')({ logger: true });
require('dotenv').config();

// Import configs
const dbConnection = require('./config/database');
const kafkaConfig = require('./config/kafka');

// Import services
const kafkaProducer = require('./services/kafkaProducer');
const jobExpanderWorker = require('../../workers/src/jobExpander'); // import your Job Expander Worker

// Import routes
const leadsRoutes = require('./routes/leads');
const segmentsRoutes = require('./routes/segments');
const campaignsRoutes = require('./routes/campaigns');
const deliveryRoutes = require('./routes/delivery');
const authRoutes = require('./routes/auth');

// Register plugins
fastify.register(require('@fastify/cors'), {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
});

fastify.register(require('./routes/webhooks/twilio'), {
  prefix: '/api/v1/webhooks/twilio'
});

fastify.register(require('@fastify/helmet'));

// Health check endpoint
fastify.get('/health', async () => {
  const dbStatus = dbConnection.isConnected() ? 'connected' : 'disconnected';
  const kafkaStatus = kafkaProducer.isProducerConnected() ? 'connected' : 'disconnected';
  const workerStatus = jobExpanderWorker.isRunning ? 'running' : 'stopped';

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      kafka: kafkaStatus,
      jobExpander: workerStatus
    }
  };
});

// API service info
fastify.get('/api/v1/status', async () => {
  return {
    service: 'Mini CRM Backend',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    features: {
      leads: '✅',
      segments: '✅',
      campaigns: '✅',
      delivery: '✅',
      auth: '🚧 (stub)'
    }
  };
});

// Register API routes
fastify.register(leadsRoutes, { prefix: '/api/v1/leads' });
fastify.register(segmentsRoutes, { prefix: '/api/v1/segments' });
fastify.register(campaignsRoutes, { prefix: '/api/v1/campaigns' });
fastify.register(deliveryRoutes, { prefix: '/api/v1/delivery' });
fastify.register(authRoutes, { prefix: '/api/auth' });

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  try {
    if (jobExpanderWorker.isRunning) await jobExpanderWorker.stop();
    await fastify.close();
    await dbConnection.disconnect();
    await kafkaProducer.disconnect();
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server and Job Expander Worker
const start = async () => {
  try {
    // Connect to database
    await dbConnection.connect({
      uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mini_crm',
      dbName: process.env.MONGODB_DB_NAME || 'mini_crm'
    });

    // Initialize Kafka producer
    await kafkaProducer.initialize(kafkaConfig);

    // Initialize and start Job Expander Worker
    await jobExpanderWorker.initialize({
      brokers: kafkaConfig.brokers,
      clientId: kafkaConfig.clientId || 'job-expander-worker',
      groupId: process.env.KAFKA_GROUP_ID || 'mini-crm-workers-group',
      mongodbUri: process.env.MONGODB_URI,
      mongodbDbName: process.env.MONGODB_DB_NAME
    });
    await jobExpanderWorker.start();
    console.log('✅ Job Expander Worker started');

    // Start Fastify server
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });

    console.log(`🚀 Backend server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`📋 API status: http://localhost:${port}/api/v1/status`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
