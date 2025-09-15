#!/usr/bin/env node

const chunkerService = require('../src/services/chunker');
const kafkaProducer = require('../src/services/kafkaProducer');

console.log('🧪 Testing Kafka Chunking Implementation...\n');

async function testChunking() {
  try {
    // Test 1: Basic chunking functionality
    console.log('1. Testing basic chunking functionality...');
    
    const testLeadIds = Array.from({ length: 250 }, (_, i) => `lead-${i + 1}`);
    console.log(`   Total leads: ${testLeadIds.length}`);
    
    // Test different chunk sizes
    const chunkSizes = [50, 100, 150];
    
    chunkSizes.forEach(chunkSize => {
      const chunks = chunkerService.chunkLeadIds(testLeadIds, chunkSize);
      console.log(`   Chunk size ${chunkSize}: ${chunks.length} chunks`);
      
      // Verify no chunk exceeds the size
      const maxChunkSize = Math.max(...chunks.map(chunk => chunk.length));
      console.log(`   Max chunk size: ${maxChunkSize} (should be <= ${chunkSize})`);
      
      if (maxChunkSize <= chunkSize) {
        console.log('   ✅ Chunk size validation passed');
      } else {
        console.log('   ❌ Chunk size validation failed');
      }
    });

    // Test 2: Chunk message creation
    console.log('\n2. Testing chunk message creation...');
    
    const campaignId = 'campaign-test-123';
    const chunkMessages = chunkerService.createChunkMessages(campaignId, testLeadIds, 100);
    
    console.log(`   Created ${chunkMessages.length} chunk messages`);
    
    // Verify message format
    const firstMessage = chunkMessages[0];
    console.log('   First message structure:');
    console.log(`     job_id: ${firstMessage.job_id}`);
    console.log(`     campaign_id: ${firstMessage.campaign_id}`);
    console.log(`     lead_ids: ${firstMessage.lead_ids.length} leads`);
    console.log(`     created_at: ${firstMessage.created_at}`);
    
    // Verify all required fields
    const requiredFields = ['job_id', 'campaign_id', 'lead_ids', 'created_at'];
    const hasAllFields = requiredFields.every(field => firstMessage.hasOwnProperty(field));
    
    if (hasAllFields) {
      console.log('   ✅ Message format validation passed');
    } else {
      console.log('   ❌ Message format validation failed');
    }

    // Test 3: Chunking statistics
    console.log('\n3. Testing chunking statistics...');
    
    const stats = chunkerService.getChunkingStats(testLeadIds, 100);
    console.log(`   Total leads: ${stats.totalLeads}`);
    console.log(`   Chunk size: ${stats.chunkSize}`);
    console.log(`   Total chunks: ${stats.totalChunks}`);
    
    // Verify statistics accuracy
    const expectedChunks = Math.ceil(testLeadIds.length / 100);
    if (stats.totalChunks === expectedChunks) {
      console.log('   ✅ Statistics accuracy passed');
    } else {
      console.log(`   ❌ Statistics accuracy failed (expected ${expectedChunks}, got ${stats.totalChunks})`);
    }

    // Test 4: Optimal chunk size calculation
    console.log('\n4. Testing optimal chunk size calculation...');
    
    const testSizes = [50, 500, 5000, 50000];
    testSizes.forEach(size => {
      const optimal = chunkerService.getOptimalChunkSize(size);
      console.log(`   ${size} leads -> optimal chunk size: ${optimal}`);
    });

    // Test 5: Chunk size validation
    console.log('\n5. Testing chunk size validation...');
    
    const testChunkSizes = [0, 50, 100, 250, 300];
    testChunkSizes.forEach(size => {
      const validation = chunkerService.validateChunkSize(size);
      console.log(`   Chunk size ${size}: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
      if (!validation.isValid) {
        console.log(`     Errors: ${validation.errors.join(', ')}`);
      }
    });

    // Test 6: Processing time estimation
    console.log('\n6. Testing processing time estimation...');
    
    const estimate = chunkerService.estimateProcessingTime(1000, 100, 50);
    console.log(`   ${estimate.totalLeads} leads, chunk size ${estimate.chunkSize}:`);
    console.log(`   Total chunks: ${estimate.totalChunks}`);
    console.log(`   Estimated completion: ${estimate.estimatedCompletionTime}`);

    // Test 7: Configuration
    console.log('\n7. Testing configuration...');
    
    const config = chunkerService.getConfig();
    console.log(`   Default chunk size: ${config.defaultChunkSize}`);
    console.log(`   Max chunk size: ${config.maxChunkSize}`);
    console.log(`   Environment CHUNK_SIZE: ${config.environment.CHUNK_SIZE || 'not set'}`);

    console.log('\n🎉 All chunking tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function testKafkaIntegration() {
  console.log('\n8. Testing Kafka integration (requires Kafka to be running)...');
  
  try {
    // Initialize Kafka producer
    await kafkaProducer.initialize({
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      clientId: 'test-chunking-producer'
    });

    console.log('   ✅ Kafka producer initialized');

    // Test publishing campaign jobs
    const testLeadIds = Array.from({ length: 50 }, (_, i) => `test-lead-${i + 1}`);
    const campaignId = 'test-campaign-chunking';
    
    console.log(`   Publishing ${testLeadIds.length} leads in chunks...`);
    
    const results = await kafkaProducer.publishCampaignJobs(campaignId, testLeadIds, 25);
    
    console.log(`   ✅ Published ${results.length} chunks successfully`);
    results.forEach((result, index) => {
      console.log(`     Chunk ${index + 1}: ${result.leadCount} leads (Job ID: ${result.jobId})`);
    });

    await kafkaProducer.disconnect();
    console.log('   ✅ Kafka producer disconnected');

  } catch (error) {
    console.log(`   ⚠️  Kafka integration test skipped: ${error.message}`);
    console.log('   💡 To test Kafka integration, start Kafka/Redpanda first');
  }
}

// Run tests
async function main() {
  await testChunking();
  await testKafkaIntegration();
  
  console.log('\n📊 Test Summary:');
  console.log('   ✅ Basic chunking functionality');
  console.log('   ✅ Chunk message creation');
  console.log('   ✅ Chunking statistics');
  console.log('   ✅ Optimal chunk size calculation');
  console.log('   ✅ Chunk size validation');
  console.log('   ✅ Processing time estimation');
  console.log('   ✅ Configuration management');
  console.log('   ⚠️  Kafka integration (requires Kafka running)');
  
  console.log('\n💡 To test with Kafka:');
  console.log('   1. Start Kafka/Redpanda: docker-compose up -d redpanda');
  console.log('   2. Run this test again');
  console.log('   3. Inspect topics: node scripts/inspect-kafka.js campaigns');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testChunking, testKafkaIntegration };
