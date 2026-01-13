/**
 * MCP (Model Context Protocol) type definitions for AWS Documentation server
 */

// MCP Search Topics
export type MCPSearchTopic = 
  | 'reference_documentation'  // API methods, SDK code, CLI commands
  | 'current_awareness'        // New features, announcements, releases
  | 'troubleshooting'          // Error messages, debugging, problems
  | 'amplify_docs'            // Frontend/mobile apps with Amplify framework
  | 'cdk_docs'                // CDK concepts, API references, CLI commands
  | 'cdk_constructs'          // CDK code examples, patterns, L3 constructs
  | 'cloudformation'          // CloudFormation templates, concepts, SAM patterns
  | 'general';                // Architecture, best practices, tutorials, blog posts

// MCP Server Response Types
export interface MCPSearchResult {
  rank_order: number;
  url: string;
  title: string;
  context: string;
}

export interface MCPSearchResponse {
  content: {
    result: MCPSearchResult[];
  };
}

export interface MCPDocumentationContent {
  content: string;
  truncated?: boolean;
  length?: number;
}

export interface MCPRecommendation {
  url: string;
  title: string;
  context?: string;
}

export interface MCPRecommendationsResponse {
  highly_rated: MCPRecommendation[];
  new: MCPRecommendation[];
  similar: MCPRecommendation[];
  journey: MCPRecommendation[];
}

export interface MCPRegionalAvailability {
  resource_id: string;
  status: 'isAvailableIn' | 'isNotAvailableIn' | 'Not Found' | 'isPlannedIn';
  region: string;
}

export interface MCPRegion {
  region_id: string;
  region_long_name: string;
}

// MCP Client Configuration
export interface MCPClientConfig {
  serverUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  maxConcurrentRequests?: number;
}

// MCP Search Options
export interface MCPSearchOptions {
  topics?: MCPSearchTopic[];
  limit?: number;
  includeRecommendations?: boolean;
  maxLength?: number;
}

// MCP Error Types
export interface MCPError {
  code: string;
  message: string;
  details?: any;
}

// MCP Client Response Wrapper
export interface MCPResponse<T> {
  success: boolean;
  data?: T;
  error?: MCPError;
  timestamp: string;
  responseTime: number;
  fallback?: boolean;        // Indicates if result is from fallback/cache
  warning?: string;          // Warning message for users
}

// Search Strategy Types
export interface SearchStrategy {
  primaryTopics: MCPSearchTopic[];
  fallbackTopics: MCPSearchTopic[];
  maxResults: number;
  timeout: number;
}

export interface QuestionAnalysis {
  questionType: 'technical' | 'conceptual' | 'troubleshooting' | 'howto';
  awsServices: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  suggestedTopics: MCPSearchTopic[];
  confidence: number;
}

// Cache Types for MCP responses
export interface MCPCacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
}

export interface MCPCacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
}