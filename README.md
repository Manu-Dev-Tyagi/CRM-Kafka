# Mini CRM System

A comprehensive Customer Relationship Management (CRM) system built with Node.js, featuring real-time WhatsApp messaging, Kafka-based job processing, and MongoDB data storage. The system follows a microservices architecture with event-driven processing for scalable campaign management and lead communication.

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Workers       │
│   (Next.js)     │◄──►│   (Fastify)     │◄──►│   Cluster       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                        │
                               ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   MongoDB       │    │   Kafka/Redpanda│
                       │   Database      │    │   Message Broker│
                       └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │   WhatsApp      │
                                              │   Integration   │
                                              └─────────────────┘
```

### Microservices Architecture

1. **Backend API Gateway** (Port 3000)
   - Fastify-based REST API server
   - Handles all HTTP requests from frontend
   - Manages leads, segments, campaigns
   - Publishes jobs to Kafka for processing
   - JWT authentication and CORS support

2. **Worker Cluster** (Port 3004)
   - **Job Expander Worker**: Converts campaigns into individual message jobs
   - **Send Worker**: Processes message jobs and sends WhatsApp messages
   - **Status Aggregator Worker**: Collects and processes delivery receipts
   - Health monitoring and graceful shutdown
   - Unique consumer group isolation

3. **Message Broker** (Redpanda/Kafka)
   - Event-driven job processing
   - Topics: `campaign.jobs`, `message.send`, `delivery.receipts`
   - High-throughput message processing
   - Fault tolerance and retry mechanisms

4. **Database Layer** (MongoDB)
   - Document-based data storage
   - Collections: leads, segments, campaigns, communication_logs
   - Custom model classes with business logic
   - Aggregation pipelines for analytics

## 📱 WhatsApp Integration

### Features
- **Baileys Library Integration** (@whiskeysockets/baileys v7.0.0-rc.3)
- **QR Code Authentication** with terminal display
- **Persistent Sessions** with multi-file auth state
- **Connection Stability** with circuit breaker pattern
- **Rate Limiting** (30 messages/minute) with exponential backoff
- **Message Queue** for offline message handling
- **Heartbeat Monitoring** for connection health
- **Graceful Reconnection** with retry logic

### Connection Manager Features
```javascript
// WhatsApp Connection Manager capabilities
- Circuit breaker pattern for failure handling
- Exponential backoff with jitter for reconnections
- Message queue for offline scenarios
- Heartbeat monitoring (60s timeout)
- Concurrency limiting (5 concurrent messages)
- Session management with auto-cleanup
- Graceful shutdown with queue rejection
```

### Twilio Fallback
- **Backup messaging provider** when WhatsApp is unavailable
- **Automatic failover** on WhatsApp connection issues
- **Webhook handling** for delivery receipts
- **Production-ready configuration**

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for Redpanda infrastructure)
- **MongoDB** (local installation required)
- **Node.js 18+** (for local development)
- **Git**

### 1. Clone and Setup

```bash
git clone <repository-url>
cd Mini_CRM
```

### 2. Environment Configuration

```bash
# Backend configuration
cp backend/.env.example backend/.env

# Workers configuration
cp workers/.env.example workers/.env

# Vendor simulator configuration
cp vendor-sim/.env.example vendor-sim/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```

### 3. Database Setup

```bash
# Install MongoDB (macOS with Homebrew)
brew install mongodb-community
brew services start mongodb-community

# Initialize database with collections and indexes
make setup-mongodb
# or: node scripts/setup-local-mongodb.js
```

### 4. Infrastructure Startup

```bash
# Start Redpanda (Kafka-compatible message broker)
docker-compose up -d redpanda

# Verify infrastructure
docker-compose ps
```

### 5. Application Services

```bash
# Option 1: Full Docker stack
docker-compose up -d

# Option 2: Local development (recommended)
make dev

# Option 3: Individual services
cd backend && npm run dev    # Port 3000
cd workers && npm run dev    # Background workers
cd frontend && npm run dev   # Port 3002
```

### 6. Verification

```bash
# Backend health check
curl http://localhost:3000/health

# Detailed service status
curl http://localhost:3000/api/v1/status

# Frontend access
open http://localhost:3002

# Redpanda admin console
open http://localhost:19644
```

## 📚 Complete API Documentation

### Health & Status Endpoints

#### `GET /health`
Returns service health status with dependency checks.

**Response:**
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

#### `GET /api/v1/status`
Returns detailed service information and feature availability.

**Response:**
```json
{
  "service": "Mini CRM Backend",
  "version": "1.0.0",
  "status": "running",
  "features": {
    "leads": "✅",
    "segments": "✅",
    "campaigns": "✅",
    "delivery": "✅",
    "auth": "🚧 (stub)"
  }
}
```

### Lead Management (`/api/v1/leads/`)

#### `POST /bulk`
Bulk import/update leads with validation and deduplication.

**Request Body:**
```json
{
  "leads": [
    {
      "name": "John Doe",
      "emails": ["john@example.com"],
      "phones": ["+1234567890"],
      "total_spend": 150.00,
      "visits": 5,
      "last_order_at": "2024-01-10T10:00:00Z",
      "metadata": {"source": "website"}
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accepted": 100,
    "inserted": 85,
    "modified": 15,
    "matched": 100,
    "jobId": "uuid-string"
  }
}
```

#### `GET /`
List leads with advanced filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (1-100, default: 10)
- `search` (string): Search across name, emails, phones
- `min_spend`, `max_spend` (number): Spending range filter
- `sort_by` (string): Sort field [name, total_spend, visits, created_at]
- `sort_order` (string): Sort direction [asc, desc]

#### `GET /:id`
Retrieve single lead by ID.

#### `POST /`
Create single lead with validation.

### Segment Management (`/api/v1/segments/`)

#### `POST /`
Create segment with rule AST (Abstract Syntax Tree).

**Request Body:**
```json
{
  "name": "High Value Customers",
  "owner_user_id": "user123",
  "rule_ast": {
    "op": "AND",
    "children": [
      {
        "type": "condition",
        "field": "total_spend",
        "operator": ">",
        "value": 500
      },
      {
        "type": "condition",
        "field": "visits",
        "operator": ">=",
        "value": 3
      }
    ]
  }
}
```

#### `POST /preview`
Preview segment results before creation.

**Request Body:**
```json
{
  "rule_ast": {
    "type": "condition",
    "field": "total_spend",
    "operator": ">",
    "value": 100
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 1250,
    "sample": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "emails": ["john@example.com"],
        "total_spend": 150
      }
    ]
  }
}
```

#### `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
Standard CRUD operations for segments.

### Campaign Management (`/api/v1/campaigns/`)

#### `POST /:id/run`
**Critical Endpoint**: Execute campaign with comprehensive workflow.

**Complete Flow:**
1. Validates campaign and segment existence
2. Translates segment AST to MongoDB query
3. Fetches matching leads from database
4. Publishes campaign job to Kafka (`campaign.jobs` topic)
5. Returns execution summary

**Response:**
```json
{
  "success": true,
  "message": "Campaign 507f1f77bcf86cd799439011 triggered successfully",
  "totalLeads": 1250
}
```

## 🔄 Kafka Message Flows & Event Architecture

### Topic Structure

| Topic | Purpose | Producer | Consumer |
|-------|---------|----------|----------|
| `campaign.jobs` | Campaign execution jobs | Backend API | Job Expander Worker |
| `campaign.send_jobs` | Individual message tasks | Job Expander | Send Worker |
| `campaign.status_updates` | Delivery confirmations | Send Worker | Status Aggregator |
| `campaign.dlq` | Failed message handling | All Workers | Manual Review |

### Message Flow Diagram

```
API Gateway                Job Expander Worker           Send Worker
     │                           │                          │
     ├─► campaign.jobs ─────────►│                          │
     │   (campaignId, leadIds)   │                          │
     │                           ├─► campaign.send_jobs ───►│
     │                           │   (individual sends)     │
     │                           │                          ├─► campaign.status_updates
     │                           │                          │   (delivery status)
     │◄──────────────────────────┴──────────────────────────┘
```

### Message Schemas

#### Campaign Job (`campaign.jobs`)
```json
{
  "campaignId": "507f1f77bcf86cd799439011",
  "leadIds": [
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

#### Send Job (`campaign.send_jobs`)
```json
{
  "send_id": "uuid-string",
  "campaign_id": "507f1f77bcf86cd799439011",
  "lead_id": "507f1f77bcf86cd799439012",
  "to": "+1234567890",
  "message": "Hi John, special offer for you!",
  "attempt": 1
}
```

#### Status Update (`campaign.status_updates`)
```json
{
  "send_id": "uuid-string",
  "campaign_id": "507f1f77bcf86cd799439011",
  "lead_id": "507f1f77bcf86cd799439012",
  "status": "SENT|FAILED|DELIVERED",
  "attempt": 1,
  "error": "Optional error message",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🧠 Advanced Segmentation Engine

### AST (Abstract Syntax Tree) Structure

The segmentation engine uses AST for complex query building:

```json
{
  "op": "AND",
  "children": [
    {
      "type": "condition",
      "field": "total_spend",
      "operator": ">",
      "value": 500
    },
    {
      "op": "OR",
      "children": [
        {
          "type": "condition",
          "field": "last_order_at",
          "operator": ">",
          "value": "30 days ago"
        },
        {
          "type": "condition",
          "field": "visits",
          "operator": ">=",
          "value": 10
        }
      ]
    }
  ]
}
```

### Supported Operators

| Operator | MongoDB | Description |
|----------|---------|-------------|
| `=` | `$eq` | Equals |
| `!=` | `$ne` | Not equals |
| `>`, `<`, `>=`, `<=` | `$gt`, `$lt`, `$gte`, `$lte` | Comparisons |
| `IN`, `NOT_IN` | `$in`, `$nin` | Array membership |
| `CONTAINS` | `$regex` | String/array contains |
| `NOT_CONTAINS` | `$not + $regex` | String/array not contains |

### Special Field Handling

- **Date Fields**: `created_at`, `last_order_at` support relative dates ("7 days ago", "2 months ago")
- **Array Fields**: `emails`, `phones`, `tags` use array-specific operators
- **Logical Operators**: `AND`, `OR`, `NOT` with proper MongoDB translation

## 🏢 Data Models & Database Schema

### Lead Model (`leads` collection)
```javascript
{
  _id: ObjectId,
  name: String (required),
  emails: [String] (required, min 1),
  phones: [String],
  total_spend: Number (default: 0),
  visits: Number (default: 0),
  last_order_at: Date,
  metadata: Object,
  created_at: Date,
  updated_at: Date
}
```

**Indexes:**
- `emails`: Compound index for deduplication
- `total_spend`: Range queries
- `created_at`: Sorting and pagination

### Campaign Model (`campaigns` collection)
```javascript
{
  _id: ObjectId,
  name: String (required),
  segment_id: ObjectId (required),
  message_template: String (required),
  created_by: String (required),
  status: Enum ["DRAFT", "RUNNING", "PAUSED", "COMPLETED"],
  stats: {
    audience: Number,
    sent: Number,
    failed: Number,
    delivered: Number
  },
  created_at: Date,
  updated_at: Date
}
```

### Segment Model (`segments` collection)
```javascript
{
  _id: ObjectId,
  name: String (required),
  owner_user_id: String (required),
  rule_ast: Object (required),
  created_at: Date,
  updated_at: Date
}
```

### Communication Log (`communication_logs` collection)
```javascript
{
  _id: String (UUID),
  campaign_id: ObjectId,
  lead_id: ObjectId,
  status: Enum ["PENDING", "SENT", "FAILED", "DELIVERED"],
  attempt: Number,
  error_message: String,
  created_at: Date,
  updated_at: Date
}
```

## 🔧 Worker Architecture

### Job Expander Worker (`workers/src/jobExpander.js`)

**Responsibilities:**
- Consumes `campaign.jobs` topic
- Fetches campaign and lead data
- Creates individual `CommunicationLog` records
- Personalizes message templates using `{{field}}` syntax
- Publishes individual send jobs to `campaign.send_jobs`

**Key Features:**
- Database connection management
- Lead ID normalization (string → ObjectId)
- Template personalization engine
- Error handling and logging

### Send Worker (`workers/src/sendWorker.js`)

**Responsibilities:**
- Consumes `campaign.send_jobs` topic
- Manages WhatsApp connection via Baileys
- Sends messages with delivery tracking
- Updates communication logs
- Publishes status updates

**Key Features:**
- QR code authentication flow
- Message queue for offline scenarios
- Retry logic and error handling
- Real-time delivery status tracking

## 📱 WhatsApp Integration

### Connection Management
- **Primary**: Baileys WhatsApp Web client
- **Authentication**: QR code scanning workflow
- **Session**: Persistent session storage in `whatsapp_sessions/`
- **Fallback**: Twilio integration for reliability

### Message Flow
1. Worker connects to WhatsApp Web
2. Scans QR code for authentication
3. Processes queued messages
4. Sends personalized messages
5. Tracks delivery status
6. Updates communication logs

## 🛠️ Development Guide

### Project Structure Deep Dive

```
Mini_CRM/
├── backend/src/
│   ├── config/           # Database and Kafka configuration
│   ├── models/           # MongoDB data models
│   ├── routes/           # API route handlers
│   ├── services/         # Kafka producer and utilities
│   ├── utils/            # AST translator and helpers
│   └── index.js          # Main application entry
├── workers/src/
│   ├── services/         # WhatsApp connection management
│   ├── jobExpander.js    # Campaign job processing
│   └── sendWorker.js     # Message sending worker
├── frontend/src/         # Next.js React application
├── scripts/              # Database setup scripts
└── whatsapp_sessions/    # WhatsApp session storage
```

### Local Development Workflow

```bash
# Install all dependencies
make install

# Start infrastructure
docker-compose up -d redpanda
brew services start mongodb-community

# Initialize database
make setup-mongodb

# Start services individually (recommended)
cd backend && npm run dev     # Terminal 1
cd workers && npm run dev     # Terminal 2
cd frontend && npm run dev    # Terminal 3

# Monitor logs
make logs                     # All services
make logs-backend            # Backend only
make logs-workers            # Workers only
```

### Environment Variables

#### Backend (`.env`)
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mini_crm
MONGODB_DB_NAME=mini_crm
KAFKA_BROKERS=localhost:19092
KAFKA_CLIENT_ID=mini-crm-backend
JWT_SECRET=your-secret-key
VENDOR_SIMULATOR_URL=http://localhost:3001
```

#### Workers (`.env`)
```env
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mini_crm
MONGODB_DB_NAME=mini_crm
KAFKA_BROKERS=localhost:19092
KAFKA_GROUP_ID=mini-crm-workers
VENDOR_SIMULATOR_URL=http://localhost:3001
```

### Testing Strategy

```bash
# Run all tests
make test

# Individual service tests
cd backend && npm test
cd workers && npm test
cd frontend && npm test

# Health checks
make health

# API testing with curl
curl -X POST http://localhost:3000/api/v1/leads/bulk \
  -H "Content-Type: application/json" \
  -d '{"leads": [{"name": "Test User", "emails": ["test@example.com"]}]}'
```

## 🎉 System Achievements & Current Status

### ✅ Successfully Implemented Features

**Core Infrastructure:**
- [x] **Microservices Architecture** with proper separation of concerns
- [x] **Fastify API Gateway** with comprehensive routing and middleware
- [x] **MongoDB Integration** with custom model classes and business logic
- [x] **Kafka Message Processing** with unique consumer groups and error handling
- [x] **Docker Compose Environment** for development and infrastructure
- [x] **Health Monitoring** with comprehensive status endpoints

**Data Management & Processing:**
- [x] **Lead Management** with bulk operations and deduplication
- [x] **Advanced Segmentation** with AST query building and MongoDB translation
- [x] **Campaign Creation & Execution** with full workflow automation
- [x] **Communication Logging** with UUID-based tracking and status updates
- [x] **Real-time Campaign Stats** with aggregation pipelines

**Event-Driven Architecture:**
- [x] **Job Expander Worker** for converting campaigns into individual message jobs
- [x] **Send Worker** with robust WhatsApp integration and message processing
- [x] **Status Aggregator Worker** for collecting and processing delivery receipts
- [x] **Message Personalization Engine** with template variable substitution
- [x] **Delivery Status Tracking** with real-time updates

**WhatsApp Integration (Major Achievement):**
- [x] **WhatsApp Connection Manager** with circuit breaker pattern
- [x] **Baileys Library Integration** (@whiskeysockets/baileys v7.0.0-rc.3)
- [x] **QR Code Authentication** flow with terminal display
- [x] **Session Persistence** with multi-file auth state management
- [x] **Connection Stability** with auto-reconnection and exponential backoff
- [x] **Rate Limiting** (30 messages/minute) with concurrency control
- [x] **Message Queue** for offline message handling
- [x] **Heartbeat Monitoring** for connection health tracking
- [x] **Circuit Breaker Pattern** for resilient failure handling

**Production-Ready Features:**
- [x] **Unique Consumer Group Isolation** to prevent duplicate message processing
- [x] **Graceful Shutdown** handling for all services
- [x] **Comprehensive Error Handling** across all components
- [x] **Health Endpoints** with dependency status checking
- [x] **Performance Monitoring** with real-time statistics
- [x] **Twilio Fallback Integration** for message delivery reliability

### 🔧 Technical Fixes Implemented

**Critical Stability Issues Resolved:**
- [x] **WhatsApp Connection Stability** - Implemented robust connection manager
- [x] **Duplicate Message Prevention** - Fixed with unique worker instance IDs
- [x] **Baileys Logger Compatibility** - Fixed all logger method requirements
- [x] **p-limit Import Error** - Resolved concurrency control implementation
- [x] **Missing Backend Functions** - Added publishDeliveryReceipt function
- [x] **Kafka Producer Compatibility** - Added isProducerConnected alias
- [x] **Consumer Group Conflicts** - Implemented unique group ID generation

**Performance & Reliability:**
- [x] **Rate Limiting & Exponential Backoff** for WhatsApp message sending
- [x] **Message Queue Management** for offline scenarios
- [x] **Connection Health Monitoring** with automatic recovery
- [x] **Error Recovery Patterns** with retry logic and circuit breakers
- [x] **Resource Cleanup** with proper graceful shutdown procedures

### 🚧 Partially Implemented

**Frontend:**
- [x] Basic Next.js structure with Tailwind CSS
- [x] Health status display
- [ ] Complete admin dashboard
- [ ] Campaign management UI
- [ ] Segment builder interface

**Authentication:**
- [x] JWT infrastructure setup
- [x] Google OAuth route stubs
- [ ] Complete OAuth implementation
- [ ] User management system

**Error Handling:**
- [x] Basic error logging and responses
- [ ] Comprehensive retry logic
- [ ] Dead letter queue processing
- [ ] Circuit breaker patterns

### 📋 Future Enhancements

**Analytics & Reporting:**
- [ ] Campaign performance dashboard
- [ ] Lead engagement analytics
- [ ] Delivery rate monitoring
- [ ] Revenue attribution tracking

**AI Integration:**
- [ ] OpenAI GPT message suggestions
- [ ] Natural language to AST translation
- [ ] Sentiment analysis on responses
- [ ] Predictive lead scoring

**Scalability:**
- [ ] Horizontal worker scaling
- [ ] Database sharding strategy
- [ ] Redis caching layer
- [ ] Rate limiting and throttling

**Enterprise Features:**
- [ ] Multi-tenant architecture
- [ ] Role-based access control
- [ ] Audit logging
- [ ] Data export capabilities

## 🚨 Troubleshooting Guide

### Common Issues

#### MongoDB Connection Failures
```bash
# Check MongoDB status
brew services list | grep mongodb

# Restart MongoDB
brew services restart mongodb-community

# Check logs
tail -f /usr/local/var/log/mongodb/mongo.log
```

#### Kafka/Redpanda Issues
```bash
# Check Redpanda status
docker-compose ps redpanda

# View logs
docker-compose logs -f redpanda

# Restart Redpanda
docker-compose restart redpanda
```

#### WhatsApp Connection Problems
```bash
# Clear session data
rm -rf whatsapp_sessions/baileys_auth/*

# Restart send worker
cd workers && npm run dev

# Scan new QR code when prompted
```

#### Port Conflicts
```bash
# Check port usage
lsof -i :3000  # Backend
lsof -i :3001  # Vendor simulator
lsof -i :3002  # Frontend
lsof -i :19092 # Kafka

# Kill processes if needed
kill -9 <PID>
```

### Performance Optimization

#### Database Optimization
```javascript
// Add indexes for common queries
db.leads.createIndex({ "emails": 1 })
db.leads.createIndex({ "total_spend": 1, "visits": 1 })
db.communication_logs.createIndex({ "campaign_id": 1, "status": 1 })
```

#### Kafka Optimization
```yaml
# docker-compose.yml adjustments for production
environment:
  - KAFKA_NUM_PARTITIONS=3
  - KAFKA_DEFAULT_REPLICATION_FACTOR=1
  - KAFKA_LOG_RETENTION_HOURS=168
```

### Development Tips

#### Debugging Kafka Messages
```bash
# Install kafkacat/kcat for message inspection
brew install kcat

# List topics
kcat -b localhost:19092 -L

# Consume messages
kcat -b localhost:19092 -t campaign.jobs -C

# Produce test messages
echo '{"campaignId": "test", "leadIds": ["test1"]}' | \
  kcat -b localhost:19092 -t campaign.jobs -P
```

#### Database Debugging
```javascript
// MongoDB aggregation pipeline debugging
db.campaigns.aggregate([
  { $match: { _id: ObjectId("507f1f77bcf86cd799439011") }},
  { $lookup: { from: "communication_logs", localField: "_id", foreignField: "campaign_id", as: "logs" }}
])

// Check AST translation
const astToMongoQuery = require('./backend/src/utils/astToMongoQuery');
console.log(astToMongoQuery.translate(ruleAst));
```

## 📖 Architecture Decision Records (ADRs)

### Why Kafka over Direct Database Polling?
- **Scalability**: Event-driven architecture scales horizontally
- **Reliability**: Message persistence ensures no lost campaigns
- **Decoupling**: Services can evolve independently
- **Observability**: Event streams provide audit trails

### Why AST for Segmentation?
- **Flexibility**: Complex nested conditions support
- **Performance**: Translates to optimized MongoDB queries
- **Maintainability**: Structured representation easier to validate
- **Extensibility**: New operators easily added

### Why WhatsApp over SMS?
- **Cost**: WhatsApp significantly cheaper than SMS
- **Engagement**: Higher open and response rates
- **Rich Media**: Support for images, documents, etc.
- **Global Reach**: WhatsApp ubiquity in many markets

## 🤝 Contributing

### Development Workflow

1. **Fork & Clone**: Create your own fork
2. **Branch**: Create feature branch (`git checkout -b feature/amazing-feature`)
3. **Develop**: Make changes with tests
4. **Test**: Run full test suite (`make test`)
5. **Document**: Update relevant documentation
6. **Submit**: Create pull request with description

### Code Standards

- **Backend**: ESLint configuration with Fastify patterns
- **Frontend**: Next.js conventions with Tailwind CSS
- **Database**: MongoDB best practices with proper indexing
- **API**: RESTful design with comprehensive error handling

### Testing Requirements

- **Unit Tests**: Critical business logic coverage
- **Integration Tests**: API endpoint testing
- **End-to-End**: Campaign flow validation
- **Performance Tests**: Load testing for scalability

## 📊 Monitoring & Observability

### Health Monitoring
- Service health endpoints (`/health`)
- Dependency status checking
- Resource utilization tracking
- Error rate monitoring

### Logging Strategy
- Structured JSON logging
- Correlation IDs for request tracing
- Error aggregation and alerting
- Performance metrics collection

### Metrics Collection
- Campaign success rates
- Message delivery statistics
- Worker processing times
- Database query performance

## 🔒 Security Considerations

### Authentication & Authorization
- JWT-based authentication
- Google OAuth integration
- Role-based access control (planned)
- API key management for external services

### Data Protection
- Input validation and sanitization
- SQL injection prevention (NoSQL equivalents)
- Rate limiting and DDoS protection
- Sensitive data encryption at rest

### Communication Security
- TLS encryption for all API calls
- WhatsApp session security
- Kafka message encryption (production)
- Environment variable protection

## 🎯 Frontend Development Guide

### Technology Stack Requirements
- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS for responsive design
- **State Management**: React Query (TanStack Query) for server state
- **Authentication**: JWT with secure cookie storage
- **UI Components**: Headless UI or Shadcn/ui
- **Forms**: React Hook Form with Zod validation
- **Charts**: Chart.js or Recharts for analytics
- **Real-time**: WebSocket or Server-Sent Events

### Required Pages & Features

#### 1. Dashboard (`/dashboard`)
- **Metrics Overview**: Total leads, active campaigns, delivery rates
- **Recent Activity**: Latest campaigns, message status
- **Quick Actions**: Create campaign, add leads
- **Charts**: Campaign performance, lead growth trends

#### 2. Lead Management (`/leads`)
- **Lead List**: Paginated table with search and filters
- **Bulk Import**: CSV/Excel file upload functionality
- **Lead Profile**: Detailed view with communication history
- **Advanced Filters**: By spend, visits, last order date

#### 3. Segments (`/segments`)
- **Segment List**: All segments with preview counts
- **Segment Builder**: Visual rule builder interface
- **Real-time Preview**: Live audience count updates
- **Management**: Edit, delete, duplicate segments

#### 4. Campaigns (`/campaigns`)
- **Campaign List**: All campaigns with status and live stats
- **Create Campaign**: Step-by-step wizard interface
- **Campaign Details**: Real-time stats, logs, message history
- **Message Templates**: Reusable templates with variable support

#### 5. Analytics (`/analytics`)
- **Performance Dashboard**: Delivery rates, engagement metrics
- **Campaign Analytics**: Individual campaign performance breakdown
- **Lead Analytics**: Lead behavior and spending patterns
- **Export Reports**: PDF/Excel export functionality

### API Integration Examples

#### Authentication Flow
```javascript
// Login API integration
const login = async (credentials) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  return response.json();
};
```

#### React Query Setup
```javascript
// Lead data fetching with pagination
const useLeads = (page = 1, filters = {}) => {
  return useQuery({
    queryKey: ['leads', page, filters],
    queryFn: () =>
      fetch(`/api/v1/leads?page=${page}&${new URLSearchParams(filters)}`)
        .then(res => res.json())
  });
};

// Real-time campaign stats
const useCampaignStats = (campaignId) => {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () =>
      fetch(`/api/v1/campaigns/${campaignId}`)
        .then(res => res.json()),
    refetchInterval: 5000 // Refresh every 5 seconds
  });
};
```

#### Form Validation with Zod
```javascript
import { z } from 'zod';

const campaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  segment_id: z.string().uuid('Valid segment required'),
  message_template: z.string().min(1, 'Message template required')
});

// React Hook Form integration
const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(campaignSchema)
});
```

### Component Architecture
```
frontend/src/
├── components/
│   ├── ui/                 # Base UI components
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Table.jsx
│   │   └── Modal.jsx
│   ├── forms/              # Form components
│   │   ├── LeadForm.jsx
│   │   ├── CampaignForm.jsx
│   │   └── SegmentBuilder.jsx
│   ├── charts/             # Chart components
│   │   ├── CampaignChart.jsx
│   │   ├── DeliveryChart.jsx
│   │   └── LeadGrowthChart.jsx
│   └── layout/             # Layout components
│       ├── Sidebar.jsx
│       ├── Header.jsx
│       └── Navigation.jsx
├── pages/                  # Next.js pages
│   ├── dashboard.jsx
│   ├── leads.jsx
│   ├── segments.jsx
│   ├── campaigns.jsx
│   └── analytics.jsx
├── hooks/                  # Custom hooks
│   ├── useAuth.js
│   ├── useLeads.js
│   └── useCampaigns.js
└── utils/                  # Utilities
    ├── api.js
    ├── auth.js
    └── validation.js
```

### Key API Endpoints for Frontend

#### Lead Management
```javascript
// GET /api/v1/leads - List leads with pagination
// POST /api/v1/leads/bulk - Bulk import leads
// GET /api/v1/leads/:id - Get single lead
// PUT /api/v1/leads/:id - Update lead
```

#### Campaign Management
```javascript
// GET /api/v1/campaigns - List campaigns
// POST /api/v1/campaigns - Create campaign
// GET /api/v1/campaigns/:id - Get campaign with stats
// POST /api/v1/campaigns/:id/run - Execute campaign
// PUT /api/v1/campaigns/:id/status - Update status
```

#### Segment Management
```javascript
// GET /api/v1/segments - List segments
// POST /api/v1/segments - Create segment
// POST /api/v1/segments/preview - Preview segment audience
// PUT /api/v1/segments/:id - Update segment
// DELETE /api/v1/segments/:id - Delete segment
```

### Real-time Features Implementation
```javascript
// WebSocket connection for live updates
const useRealTimeUpdates = (campaignId) => {
  const [stats, setStats] = useState({});

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/campaigns/${campaignId}`);
      const data = await response.json();
      setStats(data.stats);
    }, 5000);

    return () => clearInterval(interval);
  }, [campaignId]);

  return stats;
};
```

### Next Steps for Frontend Development

1. **Setup Next.js Project**
   ```bash
   npx create-next-app@latest frontend --typescript --tailwind --eslint
   cd frontend
   npm install @tanstack/react-query axios react-hook-form @hookform/resolvers zod
   ```

2. **Configure API Client**
   - Setup Axios with base URL and interceptors
   - Configure React Query provider
   - Implement JWT token management

3. **Implement Authentication**
   - Login/logout pages
   - Protected route middleware
   - Token refresh mechanism

4. **Build Core Features**
   - Dashboard with real-time metrics
   - Lead management CRUD operations
   - Visual segment builder interface
   - Campaign creation and monitoring

5. **Add Advanced Features**
   - Real-time campaign statistics
   - Toast notifications for status updates
   - CSV/Excel import/export functionality
   - Advanced filtering and search

## 💼 Interview Presentation Points

### Technical Highlights
- **Microservices Architecture** with clear separation of concerns
- **Event-Driven Processing** using Kafka for scalability
- **WhatsApp Integration** with robust connection management
- **AST-based Segmentation** for complex customer targeting
- **Circuit Breaker Patterns** for system resilience
- **Real-time Analytics** with MongoDB aggregation pipelines

### Business Impact
- **Cost-Effective Messaging** via WhatsApp (cheaper than SMS)
- **Scalable Processing** handles thousands of leads and campaigns
- **Real-time Monitoring** with comprehensive health checks
- **Production Ready** with proper error handling and recovery

### Problem-Solving Approach
- **Connection Stability Issues** - Implemented circuit breaker and retry logic
- **Duplicate Message Prevention** - Unique consumer group isolation
- **Performance Optimization** - Rate limiting and concurrency control
- **Error Recovery** - Comprehensive error handling and fallback mechanisms

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support & Community

- **Issues**: [GitHub Issues](https://github.com/your-repo/mini-crm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/mini-crm/discussions)
- **Documentation**: This README and inline code comments
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Built with ❤️ for scalable customer communication**

*This comprehensive Mini CRM system demonstrates enterprise-grade architecture with microservices, event-driven processing, robust WhatsApp messaging, and production-ready scalability. Perfect for interviews showcasing full-stack development skills, system design expertise, and real-world problem-solving capabilities.*