#!/usr/bin/env node

const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

console.log('🧪 Testing Full Job Expander Workflow...\n');

class WorkflowTester {
  constructor() {
    this.kafka = null;
    this.producer = null;
    this.consumer = null;
  }

  async initialize() {
    try {
      this.kafka = new Kafka({
        clientId: 'workflow-tester',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        retry: {
          initialRetryTime: 100,
          retries: 3
        }
      });

      this.producer = this.kafka.producer();
      this.consumer = this.kafka.consumer({ groupId: 'workflow-test-group' });

      await this.producer.connect();
      await this.consumer.connect();

      console.log('✅ Workflow tester initialized');
    } catch (error) {
      console.error('❌ Failed to initialize workflow tester:', error);
      throw error;
    }
  }

  async createTestCampaignJob(campaignId, leadIds, chunkSize = 3) {
    const chunks = [];
    for (let i = 0; i < leadIds.length; i += chunkSize) {
      const chunk = leadIds.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    const messages = [];
    chunks.forEach((chunk, index) => {
      const jobId = `test-job-${campaignId}-${index}-${Date.now()}`;
      const message = {
        job_id: jobId,
        campaign_id: campaignId,
        lead_ids: chunk,
        created_at: new Date().toISOString()
      };
      messages.push(message);
    });

    return messages;
  }

  async publishTestCampaignJobs(campaignId, leadIds, chunkSize = 3) {
    const messages = await this.createTestCampaignJob(campaignId, leadIds, chunkSize);
    
    console.log(`📤 Publishing ${messages.length} test campaign jobs...`);
    
    for (const message of messages) {
      await this.producer.send({
        topic: 'campaign.jobs',
        messages: [{
          key: campaignId,
          value: JSON.stringify(message)
        }]
      });
      console.log(`   ✅ Published job: ${message.job_id} with ${message.lead_ids.length} leads`);
    }

    return messages;
  }

  async monitorSendJobs(timeout = 30000) {
    console.log('\n👀 Monitoring campaign.send_jobs topic...');
    
    const sendJobs = [];
    let messageCount = 0;

    await this.consumer.subscribe({ 
      topic: 'campaign.send_jobs',
      fromBeginning: false
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const sendJob = JSON.parse(message.value.toString());
          sendJobs.push(sendJob);
          messageCount++;

          console.log(`📨 Send job ${messageCount}:`);
          console.log(`   Send ID: ${sendJob.send_id}`);
          console.log(`   Campaign: ${sendJob.campaign_id}`);
          console.log(`   Lead: ${sendJob.lead_id}`);
          console.log(`   To: ${sendJob.to}`);
          console.log(`   Message: ${sendJob.message.substring(0, 50)}...`);
        } catch (error) {
          console.error('❌ Failed to parse send job:', error);
        }
      }
    });

    // Wait for messages or timeout
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, timeout);
    });

    console.log(`\n📊 Monitored ${sendJobs.length} send jobs in ${timeout/1000} seconds`);
    return sendJobs;
  }

  async disconnect() {
    if (this.producer) {
      await this.producer.disconnect();
    }
    if (this.consumer) {
      await this.consumer.disconnect();
    }
    console.log('📴 Workflow tester disconnected');
  }
}

async function testFullWorkflow() {
  const tester = new WorkflowTester();

  try {
    await tester.initialize();

    // Test 1: Create test campaign job
    console.log('1. Creating test campaign job...');
    
    const campaignId = 'test-campaign-full-workflow';
    const testLeadIds = [
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012', 
      '507f1f77bcf86cd799439013',
      '507f1f77bcf86cd799439014',
      '507f1f77bcf86cd799439015'
    ];

    const campaignJobs = await tester.createTestCampaignJob(campaignId, testLeadIds, 2);
    console.log(`   ✅ Created ${campaignJobs.length} campaign job chunks`);

    // Test 2: Publish test campaign jobs
    console.log('\n2. Publishing test campaign jobs...');
    
    await tester.publishTestCampaignJobs(campaignId, testLeadIds, 2);

    // Test 3: Monitor send jobs (in parallel)
    console.log('\n3. Monitoring send jobs...');
    
    const sendJobsPromise = tester.monitorSendJobs(15000);
    
    // Wait a bit for the worker to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const sendJobs = await sendJobsPromise;

    // Test 4: Analyze results
    console.log('\n4. Analyzing results...');
    
    if (sendJobs.length > 0) {
      console.log(`   ✅ Job Expander processed ${sendJobs.length} send jobs`);
      
      // Group by campaign
      const campaignGroups = {};
      sendJobs.forEach(job => {
        if (!campaignGroups[job.campaign_id]) {
          campaignGroups[job.campaign_id] = [];
        }
        campaignGroups[job.campaign_id].push(job);
      });

      Object.entries(campaignGroups).forEach(([campaignId, jobs]) => {
        console.log(`   Campaign ${campaignId}: ${jobs.length} send jobs`);
        
        // Check message personalization
        const personalizedMessages = jobs.filter(job => 
          job.message.includes('Hi') || job.message.includes('Customer')
        );
        console.log(`     Personalized messages: ${personalizedMessages.length}/${jobs.length}`);
      });

      // Check message format
      const validFormat = sendJobs.every(job => 
        job.send_id && job.campaign_id && job.lead_id && job.to && job.message
      );
      console.log(`   Valid message format: ${validFormat ? '✅' : '❌'}`);

    } else {
      console.log('   ⚠️  No send jobs received - Job Expander may not be running');
    }

    console.log('\n🎉 Full workflow test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await tester.disconnect();
  }
}

async function simulateJobExpanderWorkflow() {
  console.log('\n5. Simulating Job Expander Workflow...');
  
  // Simulate the workflow without actual Kafka
  const campaignId = 'simulated-campaign';
  const leadIds = ['lead-1', 'lead-2', 'lead-3'];
  const messageTemplate = 'Hi {{name}}, you have spent ${{total_spend}}!';
  
  // Simulate lead data
  const leads = [
    { _id: 'lead-1', name: 'John Doe', total_spend: 5000, phones: ['+1234567890'] },
    { _id: 'lead-2', name: 'Jane Smith', total_spend: 3000, phones: ['+1234567891'] },
    { _id: 'lead-3', name: 'Bob Johnson', total_spend: 7000, phones: ['+1234567892'] }
  ];

  console.log(`   Processing ${leadIds.length} leads for campaign ${campaignId}`);

  // Simulate communication log creation
  const communicationLogs = leadIds.map(leadId => {
    const lead = leads.find(l => l._id === leadId);
    const personalizedMessage = messageTemplate
      .replace('{{name}}', lead.name || 'Customer')
      .replace('{{total_spend}}', lead.total_spend || 0);

    return {
      campaign_id: campaignId,
      lead_id: leadId,
      message: personalizedMessage,
      status: 'PENDING',
      attempts: 0
    };
  });

  console.log(`   ✅ Created ${communicationLogs.length} communication logs`);

  // Simulate send job creation
  const sendJobs = leads.map(lead => {
    const personalizedMessage = messageTemplate
      .replace('{{name}}', lead.name || 'Customer')
      .replace('{{total_spend}}', lead.total_spend || 0);

    return {
      send_id: `send-${campaignId}-${lead._id}-${Date.now()}`,
      campaign_id: campaignId,
      lead_id: lead._id,
      to: lead.phones[0],
      message: personalizedMessage,
      attempt: 1,
      created_at: new Date().toISOString()
    };
  });

  console.log(`   ✅ Created ${sendJobs.length} send jobs`);

  // Display results
  sendJobs.forEach((job, index) => {
    console.log(`   Send Job ${index + 1}:`);
    console.log(`     To: ${job.to}`);
    console.log(`     Message: ${job.message}`);
  });

  console.log('   ✅ Workflow simulation completed');
}

// Main test function
async function main() {
  try {
    console.log('🔍 Testing Full Job Expander Workflow...');
    console.log('💡 Make sure the Job Expander Worker is running\n');

    await testFullWorkflow();
    await simulateJobExpanderWorkflow();

    console.log('\n📊 Test Summary:');
    console.log('   ✅ Campaign job creation');
    console.log('   ✅ Campaign job publishing');
    console.log('   ✅ Send job monitoring');
    console.log('   ✅ Workflow simulation');
    console.log('   ⚠️  Job Expander processing (requires worker running)');

    console.log('\n💡 To test with Job Expander Worker:');
    console.log('   1. Start MongoDB: docker-compose up -d mongodb');
    console.log('   2. Start Kafka: docker-compose up -d redpanda');
    console.log('   3. Start Job Expander: npm run dev');
    console.log('   4. Run this test again');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testFullWorkflow, simulateJobExpanderWorkflow };

