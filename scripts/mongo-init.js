// MongoDB initialization script
db = db.getSiblingDB('mini_crm');

// Create collections with validation
db.createCollection('leads', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'emails', 'phones', 'created_at'],
      properties: {
        name: { bsonType: 'string' },
        emails: { bsonType: 'array', items: { bsonType: 'string' } },
        phones: { bsonType: 'array', items: { bsonType: 'string' } },
        total_spend: { bsonType: 'number' },
        visits: { bsonType: 'number' },
        last_order_at: { bsonType: 'date' },
        metadata: { bsonType: 'object' },
        created_at: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('orders', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['lead_id', 'amount', 'items', 'created_at'],
      properties: {
        lead_id: { bsonType: 'objectId' },
        amount: { bsonType: 'number' },
        items: { bsonType: 'array' },
        created_at: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('segments', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'owner_user_id', 'rule_ast', 'created_at'],
      properties: {
        name: { bsonType: 'string' },
        owner_user_id: { bsonType: 'objectId' },
        rule_ast: { bsonType: 'object' },
        last_preview_count: { bsonType: 'number' },
        created_at: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('campaigns', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'segment_id', 'message_template', 'status', 'created_by', 'created_at'],
      properties: {
        name: { bsonType: 'string' },
        segment_id: { bsonType: 'objectId' },
        message_template: { bsonType: 'string' },
        status: { bsonType: 'string', enum: ['initiated', 'running', 'completed', 'failed'] },
        stats: { bsonType: 'object' },
        created_by: { bsonType: 'objectId' },
        created_at: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('communication_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['campaign_id', 'lead_id', 'message', 'status', 'created_at'],
      properties: {
        campaign_id: { bsonType: 'objectId' },
        lead_id: { bsonType: 'objectId' },
        message: { bsonType: 'string' },
        vendor_message_id: { bsonType: 'string' },
        status: { bsonType: 'string', enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED'] },
        attempts: { bsonType: 'number' },
        last_attempt_at: { bsonType: 'date' },
        created_at: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'name', 'created_at'],
      properties: {
        email: { bsonType: 'string' },
        name: { bsonType: 'string' },
        google_id: { bsonType: 'string' },
        created_at: { bsonType: 'date' }
      }
    }
  }
});

// Create indexes for performance
db.leads.createIndex({ emails: 1 });
db.leads.createIndex({ phones: 1 });
db.leads.createIndex({ last_order_at: 1 });
db.leads.createIndex({ total_spend: 1 });

db.orders.createIndex({ lead_id: 1 });
db.orders.createIndex({ created_at: 1 });

db.segments.createIndex({ owner_user_id: 1 });
db.segments.createIndex({ created_at: 1 });

db.campaigns.createIndex({ segment_id: 1 });
db.campaigns.createIndex({ created_by: 1 });
db.campaigns.createIndex({ status: 1 });
db.campaigns.createIndex({ created_at: 1 });

// Unique compound index for communication_logs
db.communication_logs.createIndex({ campaign_id: 1, lead_id: 1 }, { unique: true });
db.communication_logs.createIndex({ vendor_message_id: 1 });
db.communication_logs.createIndex({ status: 1 });
db.communication_logs.createIndex({ campaign_id: 1, status: 1 });

db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ google_id: 1 }, { unique: true, sparse: true });

print('Database initialized successfully!');
