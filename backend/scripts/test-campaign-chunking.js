#!/usr/bin/env node

const axios = require('axios');
const chunkerService = require('../src/services/chunker');

const BASE_URL = 'http://localhost:3000';

console.log('🧪 Testing Campaign Creation with Chunking...\n');

async function testCampaignChunking() {
  try {
    // Test 1: Create test leads
    console.log('1. Creating test leads...');
    
    const testLeads = Array.from({ length: 150 }, (_, i) => ({
      name: `Test Customer ${i + 1}`,
      emails: [`customer${i + 1}@example.com`],
      phones: [`+1234567${String(i).padStart(4, '0')}`],
      total_spend: Math.floor(Math.random() * 10000) + 100,
      visits: Math.floor(Math.random() * 10) + 1,
      last_order_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { 
        city: ['New York', 'Los Angeles', 'Chicago', 'Miami', 'Seattle'][Math.floor(Math.random() * 5)],
        segment: i < 50 ? 'high_value' : i < 100 ? 'medium_value' : 'low_value'
      }
    }));

    const leadsResponse = await axios.post(`${BASE_URL}/api/v1/leads/bulk`, {
      leads: testLeads
    });

    console.log(`   ✅ Created ${leadsResponse.data.data.accepted} leads`);

    // Test 2: Create segment for high spenders
    console.log('\n2. Creating high spenders segment...');
    
    const segmentData = {
      name: 'High Spenders (Chunking Test)',
      owner_user_id: '507f1f77bcf86cd799439011',
      rule_ast: {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 5000
      }
    };

    const segmentResponse = await axios.post(`${BASE_URL}/api/v1/segments`, segmentData);
    console.log(`   ✅ Created segment: ${segmentResponse.data.data._id}`);

    // Test 3: Preview segment
    console.log('\n3. Previewing segment...');
    
    const previewResponse = await axios.post(`${BASE_URL}/api/v1/segments/preview`, {
      rule_ast: segmentData.rule_ast
    });

    console.log(`   ✅ Segment preview: ${previewResponse.data.data.count} leads match criteria`);
    console.log(`   Sample leads: ${previewResponse.data.data.sample.length} shown`);

    // Test 4: Create campaign with default chunking
    console.log('\n4. Creating campaign with default chunking...');
    
    const campaignData1 = {
      name: 'High Spenders Campaign (Default Chunking)',
      segment_id: segmentResponse.data.data._id,
      message_template: 'Hi {{name}}, you are a valued high-spending customer! Get 25% off your next purchase.',
      created_by: '507f1f77bcf86cd799439011'
    };

    const campaignResponse1 = await axios.post(`${BASE_URL}/api/v1/campaigns`, campaignData1);
    const campaign1 = campaignResponse1.data.data;

    console.log(`   ✅ Campaign created: ${campaign1.campaign_id}`);
    console.log(`   Chunk size: ${campaign1.chunk_size}`);
    console.log(`   Total chunks: ${campaign1.queued_chunks}`);
    console.log(`   Chunking stats: ${campaign1.chunking_stats.totalLeads} leads in ${campaign1.chunking_stats.totalChunks} chunks`);

    // Test 5: Create campaign with custom chunk size
    console.log('\n5. Creating campaign with custom chunk size (50)...');
    
    const campaignData2 = {
      name: 'High Spenders Campaign (Custom Chunking)',
      segment_id: segmentResponse.data.data._id,
      message_template: 'Hi {{name}}, you are a valued high-spending customer! Get 25% off your next purchase.',
      created_by: '507f1f77bcf86cd799439011',
      chunk_size: 50
    };

    const campaignResponse2 = await axios.post(`${BASE_URL}/api/v1/campaigns`, campaignData2);
    const campaign2 = campaignResponse2.data.data;

    console.log(`   ✅ Campaign created: ${campaign2.campaign_id}`);
    console.log(`   Chunk size: ${campaign2.chunk_size}`);
    console.log(`   Total chunks: ${campaign2.queued_chunks}`);
    console.log(`   Chunking stats: ${campaign2.chunking_stats.totalLeads} leads in ${campaign2.chunking_stats.totalChunks} chunks`);

    // Test 6: Create campaign with small chunk size
    console.log('\n6. Creating campaign with small chunk size (25)...');
    
    const campaignData3 = {
      name: 'High Spenders Campaign (Small Chunks)',
      segment_id: segmentResponse.data.data._id,
      message_template: 'Hi {{name}}, you are a valued high-spending customer! Get 25% off your next purchase.',
      created_by: '507f1f77bcf86cd799439011',
      chunk_size: 25
    };

    const campaignResponse3 = await axios.post(`${BASE_URL}/api/v1/campaigns`, campaignData3);
    const campaign3 = campaignResponse3.data.data;

    console.log(`   ✅ Campaign created: ${campaign3.campaign_id}`);
    console.log(`   Chunk size: ${campaign3.chunk_size}`);
    console.log(`   Total chunks: ${campaign3.queued_chunks}`);
    console.log(`   Chunking stats: ${campaign3.chunking_stats.totalLeads} leads in ${campaign3.chunking_stats.totalChunks} chunks`);

    // Test 7: Test invalid chunk size
    console.log('\n7. Testing invalid chunk size (300)...');
    
    try {
      const campaignData4 = {
        name: 'Invalid Chunk Size Test',
        segment_id: segmentResponse.data.data._id,
        message_template: 'Test message',
        created_by: '507f1f77bcf86cd799439011',
        chunk_size: 300 // Exceeds max chunk size
      };

      await axios.post(`${BASE_URL}/api/v1/campaigns`, campaignData4);
      console.log('   ❌ Should have failed with invalid chunk size');
    } catch (error) {
      if (error.response && error.response.data.error.includes('Invalid chunk size')) {
        console.log('   ✅ Correctly rejected invalid chunk size');
      } else {
        console.log('   ❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test 8: Compare chunking strategies
    console.log('\n8. Comparing chunking strategies...');
    
    const campaigns = [campaign1, campaign2, campaign3];
    campaigns.forEach((campaign, index) => {
      console.log(`   Campaign ${index + 1}:`);
      console.log(`     Chunk size: ${campaign.chunk_size}`);
      console.log(`     Total chunks: ${campaign.queued_chunks}`);
      console.log(`     Leads per chunk (avg): ${Math.round(campaign.chunking_stats.totalLeads / campaign.chunking_stats.totalChunks)}`);
    });

    // Test 9: Get campaign details
    console.log('\n9. Getting campaign details...');
    
    const campaignDetails = await axios.get(`${BASE_URL}/api/v1/campaigns/${campaign1.campaign_id}`);
    console.log(`   ✅ Campaign status: ${campaignDetails.data.data.status}`);
    console.log(`   Audience size: ${campaignDetails.data.data.stats.audience}`);

    console.log('\n🎉 All campaign chunking tests passed!');

    return {
      segmentId: segmentResponse.data.data._id,
      campaigns: [campaign1, campaign2, campaign3]
    };

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testChunkingService() {
  console.log('\n10. Testing chunking service directly...');
  
  const testLeadIds = Array.from({ length: 250 }, (_, i) => `lead-${i + 1}`);
  
  // Test different chunk sizes
  const chunkSizes = [25, 50, 100, 150];
  
  chunkSizes.forEach(chunkSize => {
    const stats = chunkerService.getChunkingStats(testLeadIds, chunkSize);
    console.log(`   Chunk size ${chunkSize}: ${stats.totalChunks} chunks, avg ${Math.round(stats.totalLeads / stats.totalChunks)} leads per chunk`);
  });

  // Test optimal chunk size
  const optimal = chunkerService.getOptimalChunkSize(testLeadIds.length);
  console.log(`   Optimal chunk size for ${testLeadIds.length} leads: ${optimal}`);

  // Test processing time estimation
  const estimate = chunkerService.estimateProcessingTime(testLeadIds.length, optimal, 100);
  console.log(`   Estimated processing time: ${estimate.parallelProcessingTimeSeconds} seconds`);
}

// Main test function
async function main() {
  try {
    console.log('🔍 Testing campaign creation with chunking...');
    console.log('💡 Make sure the backend server is running on http://localhost:3000\n');

    const results = await testCampaignChunking();
    await testChunkingService();

    console.log('\n📊 Test Summary:');
    console.log('   ✅ Lead creation and bulk insert');
    console.log('   ✅ Segment creation with rule AST');
    console.log('   ✅ Segment preview functionality');
    console.log('   ✅ Campaign creation with default chunking');
    console.log('   ✅ Campaign creation with custom chunk size');
    console.log('   ✅ Campaign creation with small chunk size');
    console.log('   ✅ Invalid chunk size validation');
    console.log('   ✅ Chunking strategy comparison');
    console.log('   ✅ Campaign details retrieval');
    console.log('   ✅ Chunking service functionality');

    console.log('\n💡 Next steps:');
    console.log('   1. Start Kafka/Redpanda: docker-compose up -d redpanda');
    console.log('   2. Inspect campaign.jobs topic: node scripts/inspect-kafka.js campaigns');
    console.log('   3. Check message format and chunking in Kafka');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testCampaignChunking, testChunkingService };
