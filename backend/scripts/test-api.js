#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Mini CRM Backend API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data);

    // Test status endpoint
    console.log('\n2. Testing status endpoint...');
    const statusResponse = await axios.get(`${BASE_URL}/api/v1/status`);
    console.log('✅ API status:', statusResponse.data);

    // Test leads bulk insert
    console.log('\n3. Testing leads bulk insert...');
    const leadsData = {
      leads: [
        {
          name: 'John Doe',
          emails: ['john@example.com'],
          phones: ['+1234567890'],
          total_spend: 5000,
          visits: 3,
          last_order_at: '2023-01-01T00:00:00Z',
          metadata: { city: 'New York' }
        },
        {
          name: 'Jane Smith',
          emails: ['jane@example.com'],
          phones: ['+1234567891'],
          total_spend: 200,
          visits: 1,
          last_order_at: '2023-02-01T00:00:00Z',
          metadata: { city: 'Los Angeles' }
        },
        {
          name: 'Bob Johnson',
          emails: ['bob@example.com'],
          phones: ['+1234567892'],
          total_spend: 8000,
          visits: 5,
          last_order_at: '2023-03-01T00:00:00Z',
          metadata: { city: 'Chicago' }
        }
      ]
    };

    const leadsResponse = await axios.post(`${BASE_URL}/api/v1/leads/bulk`, leadsData);
    console.log('✅ Leads bulk insert:', leadsResponse.data);

    // Test segment creation
    console.log('\n4. Testing segment creation...');
    const segmentData = {
      name: 'High Spenders',
      owner_user_id: '507f1f77bcf86cd799439011',
      rule_ast: {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 1000
      }
    };

    const segmentResponse = await axios.post(`${BASE_URL}/api/v1/segments`, segmentData);
    console.log('✅ Segment created:', segmentResponse.data);
    const segmentId = segmentResponse.data.data._id;

    // Test segment preview
    console.log('\n5. Testing segment preview...');
    const previewData = {
      rule_ast: {
        type: 'condition',
        field: 'total_spend',
        operator: '>',
        value: 1000
      }
    };

    const previewResponse = await axios.post(`${BASE_URL}/api/v1/segments/preview`, previewData);
    console.log('✅ Segment preview:', previewResponse.data);

    // Test campaign creation
    console.log('\n6. Testing campaign creation...');
    const campaignData = {
      name: 'High Spenders Promotion',
      segment_id: segmentId,
      message_template: 'Hi {{name}}, you\'re a valued customer! Get 20% off your next purchase.',
      created_by: '507f1f77bcf86cd799439011'
    };

    const campaignResponse = await axios.post(`${BASE_URL}/api/v1/campaigns`, campaignData);
    console.log('✅ Campaign created:', campaignResponse.data);
    const campaignId = campaignResponse.data.data.campaign_id;

    // Test campaign details
    console.log('\n7. Testing campaign details...');
    const campaignDetailsResponse = await axios.get(`${BASE_URL}/api/v1/campaigns/${campaignId}`);
    console.log('✅ Campaign details:', campaignDetailsResponse.data);

    // Test delivery receipt webhook
    console.log('\n8. Testing delivery receipt webhook...');
    const deliveryData = {
      vendor_message_id: 'vmsg-test-123',
      campaign_id: campaignId,
      lead_id: '507f1f77bcf86cd799439012',
      status: 'DELIVERED',
      signature: 'test-signature'
    };

    const deliveryResponse = await axios.post(`${BASE_URL}/api/v1/delivery/receipt`, deliveryData);
    console.log('✅ Delivery receipt:', deliveryResponse.data);

    console.log('\n🎉 All API tests passed!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Health check');
    console.log('   ✅ API status');
    console.log('   ✅ Leads bulk insert');
    console.log('   ✅ Segment creation');
    console.log('   ✅ Segment preview');
    console.log('   ✅ Campaign creation');
    console.log('   ✅ Campaign details');
    console.log('   ✅ Delivery receipt webhook');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testAPI();
}

module.exports = testAPI;
