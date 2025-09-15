# Mini CRM - Postman Testing Guide

A comprehensive guide for testing all API endpoints using Postman to demonstrate the complete project flow. This guide provides exact request details, headers, and payloads for interview presentations.

## 🚀 Testing Environment Setup

### Base URL Configuration
```
Base URL: http://localhost:3000
Workers Health URL: http://localhost:3004
```

### Required Headers (for all requests)
```
Content-Type: application/json
Accept: application/json
```

---

## 📋 Complete Testing Flow

### Step 1: System Health Check

#### 1.1 Backend Health Check
**Method:** `GET`
**URL:** `http://localhost:3000/health`
**Headers:** None required

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "connected",
    "kafka": "connected",
    "jobExpander": "running"
  }
}
```

#### 1.2 Workers Health Check
**Method:** `GET`
**URL:** `http://localhost:3004/health`
**Headers:** None required

**Expected Response:**
```json
{
  "overall": "healthy",
  "database": {"status": "healthy"},
  "workers": {
    "JobExpander": {"status": "healthy"},
    "SendWorker": {"status": "healthy"},
    "StatusAggregator": {"status": "healthy"}
  },
  "uptime": 3600
}
```

#### 1.3 API Service Status
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/status`
**Headers:** None required

**Expected Response:**
```json
{
  "service": "Mini CRM Backend",
  "version": "1.0.0",
  "status": "running",
  "features": {
    "leads": "✅",
    "segments": "✅",
    "campaigns": "✅",
    "delivery": "✅"
  }
}
```

---

## 👥 Step 2: Lead Management Testing

### 2.1 Create Individual Lead
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/leads`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "emails": ["john.doe@example.com"],
  "phones": ["+1234567890"],
  "total_spend": 250.00,
  "visits": 5,
  "last_order_at": "2024-01-10T10:00:00.000Z",
  "metadata": {
    "source": "website",
    "campaign": "summer_sale",
    "preferences": ["electronics", "books"]
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a4b2c8d9e8f123456789ab",
    "name": "John Doe",
    "emails": ["john.doe@example.com"],
    "phones": ["+1234567890"],
    "total_spend": 250,
    "visits": 5,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2.2 Bulk Lead Import
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/leads/bulk`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "leads": [
    {
      "name": "Alice Johnson",
      "emails": ["alice.johnson@example.com"],
      "phones": ["+1234567891"],
      "total_spend": 150.00,
      "visits": 3,
      "metadata": {
        "source": "mobile_app",
        "tier": "silver"
      }
    },
    {
      "name": "Bob Smith",
      "emails": ["bob.smith@example.com"],
      "phones": ["+1234567892"],
      "total_spend": 500.00,
      "visits": 8,
      "last_order_at": "2024-01-12T15:30:00.000Z",
      "metadata": {
        "source": "referral",
        "tier": "gold"
      }
    },
    {
      "name": "Carol Williams",
      "emails": ["carol.williams@example.com"],
      "phones": ["+1234567893"],
      "total_spend": 75.00,
      "visits": 2,
      "metadata": {
        "source": "social_media",
        "tier": "bronze"
      }
    },
    {
      "name": "David Brown",
      "emails": ["david.brown@example.com"],
      "phones": ["+1234567894"],
      "total_spend": 800.00,
      "visits": 12,
      "last_order_at": "2024-01-14T09:15:00.000Z",
      "metadata": {
        "source": "website",
        "tier": "platinum"
      }
    },
    {
      "name": "Eva Davis",
      "emails": ["eva.davis@example.com"],
      "phones": ["+1234567895"],
      "total_spend": 320.00,
      "visits": 6,
      "metadata": {
        "source": "email_campaign",
        "tier": "gold"
      }
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "accepted": 5,
    "inserted": 5,
    "modified": 0,
    "matched": 5
  }
}
```

### 2.3 List All Leads
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/leads?page=1&limit=10`
**Headers:** None required

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "_id": "65a4b2c8d9e8f123456789ab",
        "name": "John Doe",
        "emails": ["john.doe@example.com"],
        "total_spend": 250,
        "visits": 5
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 6,
      "totalPages": 1
    }
  }
}
```

### 2.4 Get Single Lead
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/leads/{lead_id}`
**Replace `{lead_id}` with actual ID from previous response**

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a4b2c8d9e8f123456789ab",
    "name": "John Doe",
    "emails": ["john.doe@example.com"],
    "phones": ["+1234567890"],
    "total_spend": 250,
    "visits": 5,
    "metadata": {
      "source": "website"
    },
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 🎯 Step 3: Segment Management Testing

### 3.1 Create High-Value Customer Segment
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/segments`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "High Value Customers",
  "owner_user_id": "admin",
  "rule_ast": {
    "type": "comparison",
    "operator": ">",
    "left": {
      "type": "field",
      "value": "total_spend"
    },
    "right": {
      "type": "literal",
      "value": 200
    }
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a4b3d9e8f123456789cd",
    "name": "High Value Customers",
    "owner_user_id": "admin",
    "rule_ast": {
      "type": "comparison",
      "operator": ">",
      "left": {"type": "field", "value": "total_spend"},
      "right": {"type": "literal", "value": 200}
    },
    "created_at": "2024-01-15T10:35:00.000Z"
  }
}
```

### 3.2 Create Frequent Visitors Segment
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/segments`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Frequent Visitors",
  "owner_user_id": "admin",
  "rule_ast": {
    "type": "comparison",
    "operator": ">=",
    "left": {
      "type": "field",
      "value": "visits"
    },
    "right": {
      "type": "literal",
      "value": 5
    }
  }
}
```

### 3.3 Create Complex Multi-Condition Segment
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/segments`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Premium Customers",
  "owner_user_id": "admin",
  "rule_ast": {
    "op": "AND",
    "children": [
      {
        "type": "comparison",
        "operator": ">",
        "left": {"type": "field", "value": "total_spend"},
        "right": {"type": "literal", "value": 300}
      },
      {
        "type": "comparison",
        "operator": ">=",
        "left": {"type": "field", "value": "visits"},
        "right": {"type": "literal", "value": 4}
      }
    ]
  }
}
```

### 3.4 Preview Segment (Before Creating)
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/segments/preview`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "rule_ast": {
    "type": "comparison",
    "operator": ">",
    "left": {
      "type": "field",
      "value": "total_spend"
    },
    "right": {
      "type": "literal",
      "value": 200
    }
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "count": 4,
    "sample": [
      {
        "_id": "65a4b2c8d9e8f123456789ab",
        "name": "John Doe",
        "total_spend": 250,
        "visits": 5
      },
      {
        "_id": "65a4b2c8d9e8f123456789ac",
        "name": "Bob Smith",
        "total_spend": 500,
        "visits": 8
      }
    ]
  }
}
```

### 3.5 List All Segments
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/segments`
**Headers:** None required

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a4b3d9e8f123456789cd",
      "name": "High Value Customers",
      "owner_user_id": "admin",
      "created_at": "2024-01-15T10:35:00.000Z"
    }
  ]
}
```

### 3.6 Get Single Segment
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/segments/{segment_id}`
**Replace `{segment_id}` with actual ID**

---

## 🎪 Step 4: Campaign Management Testing

### 4.1 Create Welcome Campaign
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/campaigns`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Welcome Campaign - High Value",
  "segment_id": "65a4b3d9e8f123456789cd",
  "message_template": "Hi {{name}}! Welcome to our premium service. With your spending of ${{total_spend}}, you're one of our valued customers!",
  "created_by": "admin"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a4b4eaf123456789de",
    "name": "Welcome Campaign - High Value",
    "segment_id": "65a4b3d9e8f123456789cd",
    "message_template": "Hi {{name}}! Welcome to our premium service...",
    "created_by": "admin",
    "status": "DRAFT",
    "stats": {
      "audience": 4,
      "sent": 0,
      "failed": 0,
      "delivered": 0
    },
    "created_at": "2024-01-15T10:40:00.000Z"
  }
}
```

### 4.2 Create Promotional Campaign
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/campaigns`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Special Offer - Frequent Visitors",
  "segment_id": "{frequent_visitors_segment_id}",
  "message_template": "Hey {{name}}! 🎉 Thanks for visiting us {{visits}} times! Here's a special 20% discount just for you: CODE20OFF",
  "created_by": "admin"
}
```

### 4.3 List All Campaigns
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/campaigns`
**Headers:** None required

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a4b4eaf123456789de",
      "name": "Welcome Campaign - High Value",
      "status": "DRAFT",
      "stats": {
        "audience": 4,
        "sent": 0,
        "delivered": 0,
        "failed": 0
      },
      "created_at": "2024-01-15T10:40:00.000Z"
    }
  ]
}
```

### 4.4 Get Campaign with Real-time Stats
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/campaigns/{campaign_id}`
**Replace `{campaign_id}` with actual ID**

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a4b4eaf123456789de",
    "name": "Welcome Campaign - High Value",
    "segment_id": "65a4b3d9e8f123456789cd",
    "message_template": "Hi {{name}}! Welcome to our premium service...",
    "status": "DRAFT",
    "stats": {
      "audience": 4,
      "sent": 0,
      "delivered": 0,
      "failed": 0
    },
    "created_at": "2024-01-15T10:40:00.000Z"
  }
}
```

---

## 🚀 Step 5: Campaign Execution Testing

### 5.1 Execute Campaign (The Big Moment!)
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/campaigns/{campaign_id}/run`
**Replace `{campaign_id}` with actual campaign ID**
**Headers:**
```
Content-Type: application/json
```
**Body:** None required (empty body)

**Expected Response:**
```json
{
  "success": true,
  "message": "Campaign 65a4b4eaf123456789de triggered successfully",
  "data": {
    "campaignId": "65a4b4eaf123456789de",
    "totalLeads": 4,
    "jobPublished": true
  }
}
```

**⚠️ Important Notes for Demo:**
- This is the critical moment that triggers the entire event-driven workflow
- The campaign job is published to Kafka `campaign.jobs` topic
- Workers will start processing immediately
- You should mention: "Now the Job Expander Worker will pick up this job and create individual message tasks"

### 5.2 Monitor Campaign Progress (Call multiple times)
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/campaigns/{campaign_id}`
**Call this every 10-15 seconds to show real-time progress**

**Progressive Responses:**

**After 10 seconds:**
```json
{
  "success": true,
  "data": {
    "_id": "65a4b4eaf123456789de",
    "name": "Welcome Campaign - High Value",
    "status": "RUNNING",
    "stats": {
      "audience": 4,
      "sent": 2,
      "delivered": 0,
      "failed": 0
    }
  }
}
```

**After 30 seconds:**
```json
{
  "success": true,
  "data": {
    "_id": "65a4b4eaf123456789de",
    "name": "Welcome Campaign - High Value",
    "status": "RUNNING",
    "stats": {
      "audience": 4,
      "sent": 4,
      "delivered": 2,
      "failed": 0
    }
  }
}
```

**After 60 seconds:**
```json
{
  "success": true,
  "data": {
    "_id": "65a4b4eaf123456789de",
    "name": "Welcome Campaign - High Value",
    "status": "COMPLETED",
    "stats": {
      "audience": 4,
      "sent": 4,
      "delivered": 4,
      "failed": 0
    }
  }
}
```

---

## 📊 Step 6: Monitoring & Status Testing

### 6.1 WhatsApp Connection Status
**Method:** `GET`
**URL:** `http://localhost:3004/whatsapp`
**Headers:** None required

**Expected Response:**
```json
{
  "connected": true,
  "whatsapp": {
    "status": "connected",
    "deviceId": "3EB0123ABC456DEF",
    "userName": "Your WhatsApp Name"
  },
  "rateLimitInfo": {
    "messagesPerMinute": 30,
    "currentCount": 4,
    "resetTime": "2024-01-15T10:46:00.000Z"
  },
  "timestamp": "2024-01-15T10:45:30.000Z"
}
```

### 6.2 Worker Statistics
**Method:** `GET`
**URL:** `http://localhost:3004/stats`
**Headers:** None required

**Expected Response:**
```json
{
  "uptime": 3600,
  "workers": {
    "JobExpander": {
      "isRunning": true,
      "processedJobs": 1,
      "processedLeads": 4,
      "errors": 0,
      "lastProcessed": "2024-01-15T10:41:00.000Z"
    },
    "SendWorker": {
      "isRunning": true,
      "processed": 4,
      "sent": 4,
      "failed": 0,
      "connected": true,
      "queueSize": 0
    },
    "StatusAggregator": {
      "isRunning": true,
      "processed": 4,
      "errors": 0
    }
  },
  "timestamp": "2024-01-15T10:45:30.000Z"
}
```

### 6.3 Delivery Status Updates (Advanced)
**Method:** `GET`
**URL:** `http://localhost:3000/api/v1/delivery/campaign/{campaign_id}`
**Replace `{campaign_id}` with actual campaign ID**

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "campaignId": "65a4b4eaf123456789de",
    "totalMessages": 4,
    "statusBreakdown": {
      "SENT": 4,
      "DELIVERED": 4,
      "FAILED": 0,
      "PENDING": 0
    },
    "deliveryLogs": [
      {
        "_id": "uuid-1234",
        "lead_id": "65a4b2c8d9e8f123456789ab",
        "status": "DELIVERED",
        "attempt": 1,
        "created_at": "2024-01-15T10:41:15.000Z"
      }
    ]
  }
}
```

---

## 🎭 Step 7: Advanced Testing Scenarios

### 7.1 Test Campaign Update Status
**Method:** `PUT`
**URL:** `http://localhost:3000/api/v1/campaigns/{campaign_id}/status`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "PAUSED"
}
```

### 7.2 Test Error Handling - Invalid Segment
**Method:** `POST`
**URL:** `http://localhost:3000/api/v1/campaigns`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Test Invalid Campaign",
  "segment_id": "invalid-segment-id",
  "message_template": "This should fail",
  "created_by": "admin"
}
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "message": "Segment not found",
    "code": "SEGMENT_NOT_FOUND",
    "details": "Segment with ID invalid-segment-id does not exist"
  }
}
```

### 7.3 Test Segment Update
**Method:** `PUT`
**URL:** `http://localhost:3000/api/v1/segments/{segment_id}`
**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated High Value Customers",
  "rule_ast": {
    "type": "comparison",
    "operator": ">",
    "left": {"type": "field", "value": "total_spend"},
    "right": {"type": "literal", "value": 250}
  }
}
```

---

## 🎯 Interview Demo Script

### **Opening Statement:**
"I'll now demonstrate the complete flow of my Mini CRM system, from lead creation to campaign execution and real-time monitoring. This showcases the microservices architecture, event-driven processing, and WhatsApp integration."

### **Step-by-Step Demo Flow:**

1. **"First, let me check system health"** → Health Check APIs
2. **"Now I'll create some leads"** → Bulk Lead Import
3. **"Let me create customer segments using AST queries"** → Segment Creation
4. **"I'll create a personalized campaign"** → Campaign Creation
5. **"Watch this - I'll trigger the campaign"** → Campaign Execution
6. **"See the real-time processing"** → Monitor Campaign Progress
7. **"Check WhatsApp and worker status"** → System Monitoring

### **Key Points to Mention:**

- **"This triggers the entire event-driven workflow"** (during campaign execution)
- **"The Job Expander Worker converts this into individual message jobs"**
- **"Each message is personalized using template variables"**
- **"WhatsApp rate limiting prevents account blocking"**
- **"Circuit breaker ensures connection stability"**
- **"Real-time stats show delivery progress"**

---

## 🔧 Postman Collection Import

### Environment Variables:
```json
{
  "name": "Mini CRM Environment",
  "values": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "workers_url",
      "value": "http://localhost:3004"
    }
  ]
}
```

### Pre-request Scripts (for dynamic IDs):
```javascript
// For campaign execution - get campaign ID from previous response
pm.test("Store campaign ID", function () {
    var jsonData = pm.response.json();
    if (jsonData.success && jsonData.data._id) {
        pm.environment.set("campaign_id", jsonData.data._id);
    }
});
```

---

## 🎉 Success Indicators

### What to Look For:
- ✅ **Health checks return "healthy"**
- ✅ **Lead creation returns 201 status**
- ✅ **Segment preview shows correct count**
- ✅ **Campaign creation sets audience count**
- ✅ **Campaign execution returns success message**
- ✅ **Real-time stats show progression (sent → delivered)**
- ✅ **WhatsApp status shows "connected: true"**
- ✅ **Worker stats show processed jobs**

### Common Issues & Solutions:
- **WhatsApp not connected:** Check QR code scan, restart workers
- **Zero audience in segment:** Verify lead data matches segment rules
- **Campaign stuck in RUNNING:** Check worker logs, ensure Kafka is running
- **Messages not delivered:** Verify WhatsApp connection and rate limits

---

## 🏆 Interview Tips

1. **Start with health checks** to show system monitoring
2. **Explain AST queries** when creating segments
3. **Emphasize real-time nature** of campaign monitoring
4. **Mention scalability** - "This handles thousands of leads"
5. **Highlight error handling** - "Circuit breaker prevents failures"
6. **Show rate limiting** - "30 messages per minute prevents blocking"
7. **Demonstrate recovery** - "System auto-reconnects on failures"

---

**This guide provides everything you need for a comprehensive Postman demo of your Mini CRM system. Each request includes exact details for copy-paste convenience during interviews.**