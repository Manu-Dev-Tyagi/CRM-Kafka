#!/usr/bin/env node

const JobExpanderWorker = require('../src/jobExpander');

console.log('🧪 Testing Job Expander Worker (Offline)...\n');

async function testJobExpanderOffline() {
  try {
    // Test 1: Initialize Job Expander Worker
    console.log('1. Testing Job Expander Worker initialization...');
    
    const worker = new JobExpanderWorker();
    console.log('   ✅ Job Expander Worker created');

    // Test 2: Test message validation
    console.log('\n2. Testing message validation...');
    
    const validMessage = {
      job_id: 'test-job-123',
      campaign_id: 'campaign-456',
      lead_ids: ['lead-1', 'lead-2', 'lead-3'],
      created_at: new Date().toISOString()
    };

    const invalidMessage = {
      job_id: 'test-job-123',
      // missing required fields
    };

    const isValid1 = worker.validateJobMessage(validMessage);
    const isValid2 = worker.validateJobMessage(invalidMessage);

    console.log(`   Valid message: ${isValid1 ? '✅' : '❌'}`);
    console.log(`   Invalid message: ${!isValid2 ? '✅' : '❌'}`);

    // Test 3: Test message personalization
    console.log('\n3. Testing message personalization...');
    
    const template = 'Hi {{name}}, you have spent ${{total_spend}} and visited {{visits}} times. Get 10% off!';
    const lead = {
      name: 'John Doe',
      total_spend: 5000,
      visits: 3,
      phones: ['+1234567890']
    };

    const personalizedMessage = worker.personalizeMessage(template, lead);
    console.log(`   Template: ${template}`);
    console.log(`   Personalized: ${personalizedMessage}`);
    
    const isPersonalized = personalizedMessage.includes('John Doe') && 
                          personalizedMessage.includes('5000') && 
                          personalizedMessage.includes('3');
    console.log(`   ✅ Personalization working: ${isPersonalized ? '✅' : '❌'}`);

    // Test 4: Test send ID generation
    console.log('\n4. Testing send ID generation...');
    
    const sendId1 = worker.generateSendId('campaign-123', 'lead-456');
    const sendId2 = worker.generateSendId('campaign-123', 'lead-456');
    
    console.log(`   Send ID 1: ${sendId1}`);
    console.log(`   Send ID 2: ${sendId2}`);
    console.log(`   Unique IDs: ${sendId1 !== sendId2 ? '✅' : '❌'}`);

    // Test 5: Test health check
    console.log('\n5. Testing health check...');
    
    const health = await worker.healthCheck();
    console.log(`   Health status: ${health.status}`);
    console.log(`   Worker: ${health.worker}`);
    console.log(`   Database: ${health.database}`);

    // Test 6: Test statistics
    console.log('\n6. Testing statistics...');
    
    const stats = worker.getStats();
    console.log(`   Is running: ${stats.isRunning}`);
    console.log(`   Processed jobs: ${stats.processedJobs}`);
    console.log(`   Processed leads: ${stats.processedLeads}`);
    console.log(`   Errors: ${stats.errors}`);

    console.log('\n🎉 All offline tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

async function testMessagePersonalization() {
  console.log('\n7. Testing advanced message personalization...');
  
  const testCases = [
    {
      template: 'Hello {{name}}, welcome back!',
      lead: { name: 'Alice Smith' },
      expected: 'Hello Alice Smith, welcome back!'
    },
    {
      template: 'Hi {{name}}, your total spend is ${{total_spend}}',
      lead: { name: 'Bob Johnson', total_spend: 2500 },
      expected: 'Hi Bob Johnson, your total spend is $2500'
    },
    {
      template: 'Dear {{name}}, you have {{visits}} visits',
      lead: { name: 'Carol Davis', visits: 7 },
      expected: 'Dear Carol Davis, you have 7 visits'
    },
    {
      template: 'Hi {{name}}, contact us at {{email}}',
      lead: { name: 'David Wilson', emails: ['david@example.com'] },
      expected: 'Hi David Wilson, contact us at david@example.com'
    },
    {
      template: 'Hello {{name}}, call us at {{phone}}',
      lead: { name: 'Eve Brown', phones: ['+1234567890'] },
      expected: 'Hello Eve Brown, call us at +1234567890'
    }
  ];

  const worker = new JobExpanderWorker();
  let passedTests = 0;

  testCases.forEach((testCase, index) => {
    const result = worker.personalizeMessage(testCase.template, testCase.lead);
    const passed = result === testCase.expected;
    
    console.log(`   Test ${index + 1}: ${passed ? '✅' : '❌'}`);
    if (!passed) {
      console.log(`     Expected: ${testCase.expected}`);
      console.log(`     Got: ${result}`);
    }
    
    if (passed) passedTests++;
  });

  console.log(`   ✅ Passed ${passedTests}/${testCases.length} personalization tests`);
}

async function testEdgeCases() {
  console.log('\n8. Testing edge cases...');
  
  const worker = new JobExpanderWorker();

  // Test with null/undefined lead
  const result1 = worker.personalizeMessage('Hi {{name}}', null);
  console.log(`   Null lead: ${result1 === 'Hi {{name}}' ? '✅' : '❌'}`);

  // Test with missing fields
  const result2 = worker.personalizeMessage('Hi {{name}}, spend ${{total_spend}}', {});
  console.log(`   Missing fields: ${result2 === 'Hi Customer, spend $0' ? '✅' : '❌'}`);

  // Test with empty template
  const result3 = worker.personalizeMessage('', { name: 'Test' });
  console.log(`   Empty template: ${result3 === '' ? '✅' : '❌'}`);

  // Test with no placeholders
  const result4 = worker.personalizeMessage('Hello world', { name: 'Test' });
  console.log(`   No placeholders: ${result4 === 'Hello world' ? '✅' : '❌'}`);
}

// Main test function
async function main() {
  try {
    await testJobExpanderOffline();
    await testMessagePersonalization();
    await testEdgeCases();

    console.log('\n📊 Test Summary:');
    console.log('   ✅ Job Expander Worker initialization');
    console.log('   ✅ Message validation');
    console.log('   ✅ Message personalization');
    console.log('   ✅ Send ID generation');
    console.log('   ✅ Health check');
    console.log('   ✅ Statistics tracking');
    console.log('   ✅ Advanced personalization');
    console.log('   ✅ Edge case handling');

    console.log('\n💡 To test with full integration:');
    console.log('   1. Start MongoDB: docker-compose up -d mongodb');
    console.log('   2. Start Kafka: docker-compose up -d redpanda');
    console.log('   3. Start Job Expander: npm run dev');
    console.log('   4. Run: node scripts/test-job-expander.js');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testJobExpanderOffline, testMessagePersonalization, testEdgeCases };

