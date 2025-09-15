import { ObjectId } from 'mongodb';

// Base interfaces
export interface BaseDocument {
  _id?: ObjectId;
  created_at: Date;
  updated_at?: Date;
}

// Lead interfaces
export interface Lead extends BaseDocument {
  name: string;
  emails: string[];
  phones: string[];
  total_spend: number;
  visits: number;
  last_order_at?: Date;
  metadata: Record<string, any>;
}

export interface CreateLeadRequest {
  name: string;
  emails: string[];
  phones: string[];
  total_spend?: number;
  visits?: number;
  last_order_at?: Date;
  metadata?: Record<string, any>;
}

// Order interfaces
export interface Order extends BaseDocument {
  lead_id: ObjectId;
  amount: number;
  items: OrderItem[];
}

export interface OrderItem {
  sku: string;
  qty: number;
  price?: number;
}

export interface CreateOrderRequest {
  lead_id: string;
  amount: number;
  items: OrderItem[];
}

// Segment interfaces
export interface Segment extends BaseDocument {
  name: string;
  owner_user_id: ObjectId;
  rule_ast: RuleAST;
  last_preview_count?: number;
}

export interface CreateSegmentRequest {
  name: string;
  owner_user_id: string;
  rule_ast: RuleAST;
}

export interface SegmentPreviewResponse {
  count: number;
  sample: Lead[];
}

// Rule AST interfaces
export interface RuleAST {
  op: 'AND' | 'OR' | 'NOT';
  children?: RuleAST[];
  type?: 'condition';
  field?: string;
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT_IN' | 'CONTAINS' | 'NOT_CONTAINS';
  value?: any;
}

// Campaign interfaces
export interface Campaign extends BaseDocument {
  name: string;
  segment_id: ObjectId;
  message_template: string;
  status: 'initiated' | 'running' | 'completed' | 'failed';
  stats: CampaignStats;
  created_by: ObjectId;
}

export interface CampaignStats {
  audience: number;
  sent: number;
  failed: number;
  delivered: number;
}

export interface CreateCampaignRequest {
  name: string;
  segment_id: string;
  message_template: string;
  created_by: string;
}

export interface CampaignResponse {
  campaign_id: string;
  queued_chunks: number;
  stats: CampaignStats;
}

// Communication Log interfaces
export interface CommunicationLog extends BaseDocument {
  campaign_id: ObjectId;
  lead_id: ObjectId;
  message: string;
  vendor_message_id?: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  attempts: number;
  last_attempt_at?: Date;
}

// User interfaces
export interface User extends BaseDocument {
  email: string;
  name: string;
  google_id?: string;
}

// Kafka message interfaces
export interface CampaignJobMessage {
  job_id: string;
  campaign_id: string;
  customer_ids: string[];
  created_at: string;
}

export interface CampaignSendJobMessage {
  send_id: string;
  campaign_id: string;
  lead_id: string;
  message: string;
  attempt: number;
  created_at: string;
}

export interface DeliveryReceiptMessage {
  vendor_message_id: string;
  campaign_id: string;
  lead_id: string;
  status: 'DELIVERED' | 'FAILED';
  raw_payload: any;
  received_at: string;
}

// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BulkInsertResponse {
  accepted: number;
  jobId?: string;
}

// Database connection interface
export interface DatabaseConfig {
  uri: string;
  dbName: string;
}

// Kafka configuration interface
export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}
