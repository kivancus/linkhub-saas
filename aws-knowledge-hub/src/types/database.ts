/**
 * Database model interfaces for AWS Knowledge Hub
 */

export interface Session {
  id: string;
  created_at: string;
  last_activity: string;
  expires_at: string;
  metadata?: string; // JSON string
}

export interface SessionMetadata {
  user_agent?: string;
  ip_address?: string;
  preferences?: UserPreferences;
  [key: string]: any;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  language?: string;
  auto_suggestions?: boolean;
  response_format?: 'detailed' | 'concise';
}

export interface Conversation {
  id: number;
  session_id: string;
  question: string;
  answer: string;
  aws_services?: string; // JSON array
  search_topics?: string; // JSON array
  sources?: string; // JSON array
  response_time?: number;
  confidence_score?: number;
  created_at: string;
}

export interface DocumentationSource {
  url: string;
  title: string;
  context: string;
  relevance_score: number;
  topic: string;
}

export interface DocumentationCache {
  id: number;
  url: string;
  title?: string;
  content?: string;
  topic?: string;
  relevance_score?: number;
  last_updated: string;
  expires_at?: string;
  access_count: number;
}

export interface SearchAnalytics {
  id: number;
  session_id?: string;
  question?: string;
  question_type?: QuestionType;
  aws_services?: string; // JSON array
  search_topics?: string; // JSON array
  response_time?: number;
  success: boolean;
  error_message?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
}

export interface AwsService {
  id: number;
  service_name: string;
  service_code: string;
  category?: string;
  description?: string;
  documentation_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface QuestionSuggestion {
  id: number;
  suggestion_text: string;
  category?: string;
  aws_service?: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

// Enums and Types
export type QuestionType = 'technical' | 'conceptual' | 'troubleshooting' | 'howto';

export type ServiceCategory = 
  | 'compute' 
  | 'storage' 
  | 'database' 
  | 'networking' 
  | 'security' 
  | 'developer-tools' 
  | 'monitoring' 
  | 'analytics' 
  | 'machine-learning' 
  | 'iot' 
  | 'mobile' 
  | 'web' 
  | 'enterprise';

export type SuggestionCategory = 
  | 'general' 
  | 'service-specific' 
  | 'troubleshooting' 
  | 'security' 
  | 'best-practices';

export type SearchTopic = 
  | 'reference_documentation' 
  | 'current_awareness' 
  | 'troubleshooting' 
  | 'amplify_docs' 
  | 'cdk_docs' 
  | 'cdk_constructs' 
  | 'cloudformation' 
  | 'general';

// Database operation result types
export interface DatabaseResult {
  success: boolean;
  data?: any;
  error?: string;
  changes?: number;
  lastInsertRowid?: number;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface SearchOptions extends PaginationOptions {
  query?: string;
  filters?: Record<string, any>;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Statistics and analytics types
export interface DatabaseStats {
  sessions: { count: number };
  conversations: { count: number };
  cache_entries: { count: number };
  analytics_entries: { count: number };
  aws_services: { count: number };
  suggestions: { count: number };
}

export interface CacheStats {
  total_entries: number;
  active_entries: number;
  expired_entries: number;
  top_cached_urls: Array<{
    url: string;
    title: string;
    access_count: number;
    topic: string;
  }>;
}

export interface PopularService {
  service_name: string;
  usage_count: number;
}

export interface QuestionPattern {
  question: string;
  frequency: number;
  avg_response_time: number;
  last_asked: string;
}

// Query builder types
export interface WhereClause {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
  value: any;
}

export interface QueryBuilder {
  table: string;
  select?: string[];
  where?: WhereClause[];
  join?: Array<{
    type: 'INNER' | 'LEFT' | 'RIGHT';
    table: string;
    on: string;
  }>;
  groupBy?: string[];
  having?: WhereClause[];
  orderBy?: Array<{
    field: string;
    direction: 'ASC' | 'DESC';
  }>;
  limit?: number;
  offset?: number;
}