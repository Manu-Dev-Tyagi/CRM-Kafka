#!/usr/bin/env node

const { Kafka } = require('kafkajs');

class KafkaInspector {
  constructor() {
    this.kafka = null;
    this.consumer = null;
    this.admin = null;
  }

  async initialize(config) {
    this.kafka = new Kafka({
      clientId: config.clientId || 'kafka-inspector',
      brokers: config.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 3
      }
    });

    this.consumer = this.kafka.consumer({ groupId: 'kafka-inspector-group' });
    this.admin = this.kafka.admin();
    
    await this.consumer.connect();
    await this.admin.connect();
    
    console.log('✅ Kafka Inspector connected');
  }

  async disconnect() {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
    if (this.admin) {
      await this.admin.disconnect();
    }
    console.log('📴 Kafka Inspector disconnected');
  }

  /**
   * List all topics
   */
  async listTopics() {
    try {
      const topics = await this.admin.listTopics();
      console.log('\n📋 Available Topics:');
      topics.forEach(topic => {
        console.log(`   - ${topic}`);
      });
      return topics;
    } catch (error) {
      console.error('❌ Failed to list topics:', error.message);
      return [];
    }
  }

  /**
   * Get topic metadata
   */
  async getTopicMetadata(topicName) {
    try {
      const metadata = await this.admin.fetchTopicMetadata({ topics: [topicName] });
      if (metadata.topics.length === 0) {
        console.log(`❌ Topic '${topicName}' not found`);
        return null;
      }

      const topic = metadata.topics[0];
      console.log(`\n📊 Topic: ${topic.name}`);
      console.log(`   Partitions: ${topic.partitions.length}`);
      topic.partitions.forEach(partition => {
        console.log(`   Partition ${partition.partitionId}: Leader ${partition.leader}, Replicas: [${partition.replicas.join(', ')}]`);
      });
      
      return topic;
    } catch (error) {
      console.error(`❌ Failed to get metadata for topic '${topicName}':`, error.message);
      return null;
    }
  }

  /**
   * Inspect messages in a topic
   */
  async inspectTopic(topicName, options = {}) {
    const {
      maxMessages = 10,
      fromBeginning = false,
      partition = null,
      timeout = 10000
    } = options;

    console.log(`\n🔍 Inspecting topic: ${topicName}`);
    console.log(`   Max messages: ${maxMessages}`);
    console.log(`   From beginning: ${fromBeginning}`);
    console.log(`   Partition: ${partition || 'all'}`);
    console.log(`   Timeout: ${timeout}ms`);

    try {
      const messages = [];
      let messageCount = 0;

      // Subscribe to topic
      await this.consumer.subscribe({ 
        topic: topicName, 
        fromBeginning 
      });

      // Set up message handler
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (messageCount >= maxMessages) {
            return;
          }

          const messageData = {
            topic,
            partition,
            offset: message.offset,
            key: message.key ? message.key.toString() : null,
            timestamp: message.timestamp,
            headers: message.headers,
            value: null
          };

          try {
            messageData.value = JSON.parse(message.value.toString());
          } catch (error) {
            messageData.value = message.value.toString();
          }

          messages.push(messageData);
          messageCount++;

          console.log(`\n📨 Message ${messageCount}:`);
          console.log(`   Topic: ${topic}`);
          console.log(`   Partition: ${partition}`);
          console.log(`   Offset: ${message.offset}`);
          console.log(`   Key: ${messageData.key || 'null'}`);
          console.log(`   Timestamp: ${new Date(parseInt(message.timestamp)).toISOString()}`);
          console.log(`   Value: ${JSON.stringify(messageData.value, null, 2)}`);
        }
      });

      // Wait for messages or timeout
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, timeout);
      });

      console.log(`\n✅ Inspected ${messages.length} messages from topic '${topicName}'`);
      return messages;

    } catch (error) {
      console.error(`❌ Failed to inspect topic '${topicName}':`, error.message);
      return [];
    }
  }

  /**
   * Inspect campaign.jobs topic specifically
   */
  async inspectCampaignJobs(options = {}) {
    const messages = await this.inspectTopic('campaign.jobs', options);
    
    console.log('\n📊 Campaign Jobs Analysis:');
    const campaigns = {};
    
    messages.forEach(msg => {
      if (msg.value && msg.value.campaign_id) {
        const campaignId = msg.value.campaign_id;
        if (!campaigns[campaignId]) {
          campaigns[campaignId] = {
            campaign_id: campaignId,
            chunks: 0,
            total_leads: 0,
            job_ids: []
          };
        }
        
        campaigns[campaignId].chunks++;
        campaigns[campaignId].total_leads += msg.value.lead_ids ? msg.value.lead_ids.length : 0;
        campaigns[campaignId].job_ids.push(msg.value.job_id);
      }
    });

    Object.values(campaigns).forEach(campaign => {
      console.log(`\n🎯 Campaign: ${campaign.campaign_id}`);
      console.log(`   Chunks: ${campaign.chunks}`);
      console.log(`   Total Leads: ${campaign.total_leads}`);
      console.log(`   Job IDs: ${campaign.job_ids.join(', ')}`);
    });

    return { messages, campaigns };
  }

  /**
   * Get topic offsets
   */
  async getTopicOffsets(topicName) {
    try {
      const partitions = await this.admin.fetchTopicOffsets(topicName);
      console.log(`\n📈 Topic Offsets: ${topicName}`);
      
      partitions.forEach(partition => {
        console.log(`   Partition ${partition.partition}: ${partition.offset} (High: ${partition.high}, Low: ${partition.low})`);
      });
      
      return partitions;
    } catch (error) {
      console.error(`❌ Failed to get offsets for topic '${topicName}':`, error.message);
      return [];
    }
  }

  /**
   * Create topic if it doesn't exist
   */
  async createTopic(topicName, partitions = 3, replicationFactor = 1) {
    try {
      const topics = await this.admin.listTopics();
      if (topics.includes(topicName)) {
        console.log(`✅ Topic '${topicName}' already exists`);
        return true;
      }

      await this.admin.createTopics({
        topics: [{
          topic: topicName,
          numPartitions: partitions,
          replicationFactor: replicationFactor
        }]
      });

      console.log(`✅ Created topic '${topicName}' with ${partitions} partitions`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create topic '${topicName}':`, error.message);
      return false;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const topicName = args[1];

  const inspector = new KafkaInspector();

  try {
    await inspector.initialize({
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      clientId: 'kafka-inspector-cli'
    });

    switch (command) {
      case 'list':
        await inspector.listTopics();
        break;

      case 'metadata':
        if (!topicName) {
          console.error('❌ Please provide topic name: node inspect-kafka.js metadata <topic>');
          process.exit(1);
        }
        await inspector.getTopicMetadata(topicName);
        break;

      case 'inspect':
        if (!topicName) {
          console.error('❌ Please provide topic name: node inspect-kafka.js inspect <topic>');
          process.exit(1);
        }
        const maxMessages = parseInt(args[2]) || 10;
        await inspector.inspectTopic(topicName, { maxMessages });
        break;

      case 'campaigns':
        const maxCampaignMessages = parseInt(args[1]) || 10;
        await inspector.inspectCampaignJobs({ maxMessages: maxCampaignMessages });
        break;

      case 'offsets':
        if (!topicName) {
          console.error('❌ Please provide topic name: node inspect-kafka.js offsets <topic>');
          process.exit(1);
        }
        await inspector.getTopicOffsets(topicName);
        break;

      case 'create':
        if (!topicName) {
          console.error('❌ Please provide topic name: node inspect-kafka.js create <topic>');
          process.exit(1);
        }
        const partitions = parseInt(args[2]) || 3;
        await inspector.createTopic(topicName, partitions);
        break;

      default:
        console.log('🔍 Kafka Topic Inspector');
        console.log('\nUsage:');
        console.log('  node inspect-kafka.js list                           # List all topics');
        console.log('  node inspect-kafka.js metadata <topic>               # Get topic metadata');
        console.log('  node inspect-kafka.js inspect <topic> [maxMessages]  # Inspect topic messages');
        console.log('  node inspect-kafka.js campaigns [maxMessages]        # Inspect campaign.jobs');
        console.log('  node inspect-kafka.js offsets <topic>                # Get topic offsets');
        console.log('  node inspect-kafka.js create <topic> [partitions]    # Create topic');
        console.log('\nExamples:');
        console.log('  node inspect-kafka.js list');
        console.log('  node inspect-kafka.js inspect campaign.jobs 5');
        console.log('  node inspect-kafka.js campaigns 20');
        console.log('  node inspect-kafka.js create campaign.jobs 3');
        break;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await inspector.disconnect();
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = KafkaInspector;
