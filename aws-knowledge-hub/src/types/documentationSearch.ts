import { QuestionAnalysis } from './question';
import { MCPSearchResult, MCPSearchTopic } from './mcp';

/**
 * Documentation Search Service Type Definitions
 */

export interface DocumentationSearchRequest {
  question: string;
  sessionId: string;
  options?: DocumentationSearchOptions;
}

export interface DocumentationSearchOptions {
  maxResults?: number;
  timeout?: number;
  useCache?: boolean;
  parallelSearch?: boolean;
  topics?: MCPSearchTopic[];
  includeRelated?: boolean;
}

export interface DocumentationSearchResult {
  searchId: string;
  question: string;
  sessionId: string;
  results: SearchResultRanking[];
  questionAnalysis: QuestionAnalysis;
  searchStrategy: SearchStrategy;
  totalResults: number;
  processingTime: number;
  cached: boolean;
  success: boolean;
  error?: string;
  metadata: SearchMetadata;
}

export interface SearchResultRanking {
  result: MCPSearchResult & { enhanced?: boolean; relevanceScore?: number };
  relevanceScore: number;
  serviceMatch: boolean;
  titleMatch: boolean;
  contextMatch: boolean;
  qualityScore: number;
  finalScore: number;
}

export interface SearchStrategy {
  primaryTopics: MCPSearchTopic[];
  fallbackTopics: MCPSearchTopic[];
  maxResults: number;
  timeout: number;
  parallelSearch: boolean;
  useCache: boolean;
}

export interface SearchMetadata {
  searchTopics: MCPSearchTopic[];
  fallbackUsed: boolean;
  cacheHit: boolean;
  performanceMetrics: SearchPerformanceMetrics;
}

export interface SearchPerformanceMetrics {
  processingTime: number;
  resultCount: number;
  averageTimePerResult: number;
  cacheHitRate: number;
}

export interface SearchCacheEntry {
  result: DocumentationSearchResult;
  timestamp: number;
}

export interface SearchSuggestion {
  text: string;
  type: 'completion' | 'related' | 'popular' | 'service';
  confidence: number;
  source: 'database' | 'analysis' | 'history';
}

export interface SearchAnalytics {
  searchId: string;
  sessionId: string;
  question: string;
  questionType: string;
  awsServices: string[];
  resultCount: number;
  processingTime: number;
  success: boolean;
  createdAt: Date;
}

export interface SearchStats {
  totalSearches: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  topQuestionTypes: Array<{ type: string; count: number }>;
  topAwsServices: Array<{ service: string; count: number }>;
  successRate: number;
}