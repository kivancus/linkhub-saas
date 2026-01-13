import { mcpService } from './mcpService';
import { questionEngine } from './questionEngine';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { databaseManager } from '../database/connection';
// Inline type definitions to avoid import issues
interface DocumentationSearchRequest {
  question: string;
  sessionId: string;
  options?: {
    maxResults?: number;
    timeout?: number;
    useCache?: boolean;
    parallelSearch?: boolean;
    topics?: MCPSearchTopic[];
    includeRelated?: boolean;
  };
}

interface DocumentationSearchResult {
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
  metadata: {
    searchTopics: MCPSearchTopic[];
    fallbackUsed: boolean;
    cacheHit: boolean;
    performanceMetrics: {
      processingTime: number;
      resultCount: number;
      averageTimePerResult: number;
      cacheHitRate: number;
    };
  };
}

interface SearchResultRanking {
  result: MCPSearchResult & { enhanced?: boolean; relevanceScore?: number };
  relevanceScore: number;
  serviceMatch: boolean;
  titleMatch: boolean;
  contextMatch: boolean;
  qualityScore: number;
  finalScore: number;
}

interface SearchStrategy {
  primaryTopics: MCPSearchTopic[];
  fallbackTopics: MCPSearchTopic[];
  maxResults: number;
  timeout: number;
  parallelSearch: boolean;
  useCache: boolean;
}

interface SearchCacheEntry {
  result: DocumentationSearchResult;
  timestamp: number;
}

interface SearchPerformanceMetrics {
  processingTime: number;
  resultCount: number;
  averageTimePerResult: number;
  cacheHitRate: number;
}
import {
  MCPSearchResult,
  MCPSearchTopic
} from '../types/mcp';
import { QuestionAnalysis } from '../types/question';

/**
 * Documentation Search Service
 * 
 * Provides intelligent search across AWS documentation using MCP server
 * with advanced ranking, caching, and result optimization
 */
class DocumentationSearchService {
  private cache = new Map<string, SearchCacheEntry>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Perform comprehensive documentation search
   */
  public async search(request: DocumentationSearchRequest): Promise<DocumentationSearchResult> {
    const startTime = Date.now();
    const searchId = this.generateSearchId(request);

    try {
      logger.info('Starting documentation search', {
        searchId,
        question: request.question.substring(0, 100),
        sessionId: request.sessionId
      });

      // Check cache first
      const cachedResult = this.getCachedResult(request);
      if (cachedResult) {
        logger.info('Returning cached search result', { searchId });
        return {
          ...cachedResult,
          searchId,
          cached: true,
          processingTime: Date.now() - startTime
        };
      }

      // Process question to understand intent and extract services
      const questionResult = await questionEngine.processQuestion(
        request.question,
        request.sessionId,
        { source: 'documentation_search' as 'api' | 'web' | 'mobile' | 'test' }
      );

      if (!questionResult.success) {
        throw new Error(questionResult.error || 'Question processing failed');
      }

      // Create search strategy based on question analysis
      const searchStrategy = this.createSearchStrategy(
        questionResult.analysis,
        request.options
      );

      // Execute search with strategy
      const searchResults = await this.executeSearchStrategy(
        request.question,
        searchStrategy
      );

      // Rank and filter results
      const rankedResults = this.rankResults(
        searchResults,
        questionResult.analysis,
        request.question
      );

      // Apply result limits
      const limitedResults = this.applyResultLimits(
        rankedResults,
        request.options?.maxResults || 10
      );

      // Enhance results with additional metadata
      const enhancedResults = await this.enhanceResults(
        limitedResults,
        questionResult.analysis
      );

      // Create final result
      const result: DocumentationSearchResult = {
        searchId,
        question: request.question,
        sessionId: request.sessionId,
        results: enhancedResults,
        questionAnalysis: questionResult.analysis,
        searchStrategy,
        totalResults: searchResults.length,
        processingTime: Date.now() - startTime,
        cached: false,
        success: true,
        metadata: {
          searchTopics: searchStrategy.primaryTopics,
          fallbackUsed: searchStrategy.fallbackTopics.length > 0,
          cacheHit: false,
          performanceMetrics: this.calculatePerformanceMetrics(startTime, searchResults.length)
        }
      };

      // Cache the result
      this.cacheResult(request, result);

      // Store search analytics
      await this.storeSearchAnalytics(result);

      logger.info('Documentation search completed successfully', {
        searchId,
        resultCount: enhancedResults.length,
        processingTime: result.processingTime,
        questionType: questionResult.analysis.questionType,
        awsServices: questionResult.analysis.awsServices.map((s: any) => s.serviceName)
      });

      return result;

    } catch (error) {
      logger.error('Documentation search failed', {
        searchId,
        error: getErrorMessage(error),
        question: request.question.substring(0, 100),
        sessionId: request.sessionId
      });

      return {
        searchId,
        question: request.question,
        sessionId: request.sessionId,
        results: [],
        questionAnalysis: {
          questionId: searchId,
          questionType: 'conceptual',
          awsServices: [],
          complexity: 'simple',
          intent: 'learn',
          entities: [],
          confidence: 0,
          suggestedActions: [],
          processingTime: 0
        },
        searchStrategy: this.createDefaultStrategy(),
        totalResults: 0,
        processingTime: Date.now() - startTime,
        cached: false,
        success: false,
        error: getErrorMessage(error),
        metadata: {
          searchTopics: [],
          fallbackUsed: false,
          cacheHit: false,
          performanceMetrics: this.calculatePerformanceMetrics(startTime, 0)
        }
      };
    }
  }

  /**
   * Get search suggestions based on partial input
   */
  public async getSuggestions(
    partialQuestion: string,
    sessionId: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      // Get suggestions from question engine
      const questionResult = await questionEngine.processQuestion(
        partialQuestion,
        sessionId,
        { source: 'api' }
      );

      const suggestions: string[] = [];

      // Add suggestions from question engine
      questionResult.suggestions.forEach(suggestion => {
        if (suggestion.type === 'completion' || suggestion.type === 'related') {
          suggestions.push(suggestion.text);
        }
      });

      // Add common AWS questions based on detected services
      const awsServices = questionResult.analysis.awsServices.map((s: any) => s.serviceName);
      if (awsServices.length > 0) {
        const commonQuestions = await this.getCommonQuestions(awsServices[0]);
        suggestions.push(...commonQuestions.slice(0, limit - suggestions.length));
      }

      // Get suggestions from database
      const dbSuggestions = await this.getDatabaseSuggestions(partialQuestion, limit);
      suggestions.push(...dbSuggestions);

      // Remove duplicates and limit results
      return [...new Set(suggestions)].slice(0, limit);

    } catch (error) {
      logger.error('Failed to get search suggestions', {
        error: getErrorMessage(error),
        partialQuestion: partialQuestion.substring(0, 50)
      });
      return [];
    }
  }

  /**
   * Get related documentation for a specific result
   */
  public async getRelatedDocumentation(
    url: string,
    limit: number = 5
  ): Promise<MCPSearchResult[]> {
    try {
      const response = await mcpService.getRelatedDocumentation(url);
      
      // MCPRecommendationsResponse has different categories, combine them
      const allRecommendations = [
        ...(response?.highly_rated || []),
        ...(response?.similar || []),
        ...(response?.new || []),
        ...(response?.journey || [])
      ];

      // Convert MCPRecommendation to MCPSearchResult format
      const searchResults: MCPSearchResult[] = allRecommendations.map((rec, index) => ({
        rank_order: index + 1,
        url: rec.url,
        title: rec.title,
        context: rec.context || ''
      }));

      return searchResults.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get related documentation', {
        error: getErrorMessage(error),
        url
      });
      return [];
    }
  }

  /**
   * Clear search cache
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('Search cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttl: this.CACHE_TTL,
      hitRate: this.calculateCacheHitRate()
    };
  }

  // Private helper methods

  private generateSearchId(request: DocumentationSearchRequest): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(request.question + request.sessionId + JSON.stringify(request.options || {}))
      .digest('hex');
    return `search_${hash.substring(0, 8)}`;
  }

  private getCachedResult(request: DocumentationSearchRequest): DocumentationSearchResult | null {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  private cacheResult(request: DocumentationSearchRequest, result: DocumentationSearchResult): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }

    const cacheKey = this.generateCacheKey(request);
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  private generateCacheKey(request: DocumentationSearchRequest): string {
    return `${request.question}_${JSON.stringify(request.options || {})}`;
  }

  private createSearchStrategy(
    analysis: QuestionAnalysis,
    options?: DocumentationSearchRequest['options']
  ): SearchStrategy {
    // Convert question analysis to the format expected by search strategy
    const mcpTopics = this.convertToMCPTopics(analysis);
    
    const strategy: SearchStrategy = {
      primaryTopics: mcpTopics.primary,
      fallbackTopics: mcpTopics.fallback,
      maxResults: options?.maxResults || 10,
      timeout: options?.timeout || this.DEFAULT_TIMEOUT,
      parallelSearch: options?.parallelSearch !== false,
      useCache: options?.useCache !== false
    };

    // Adjust strategy based on complexity
    if (analysis.complexity === 'complex') {
      strategy.maxResults = Math.max(strategy.maxResults, 15);
      strategy.timeout = Math.max(strategy.timeout, 45000);
    } else if (analysis.complexity === 'simple') {
      strategy.maxResults = Math.min(strategy.maxResults, 8);
      strategy.timeout = Math.min(strategy.timeout, 20000);
    }

    return strategy;
  }

  private convertToMCPTopics(analysis: QuestionAnalysis): { primary: MCPSearchTopic[], fallback: MCPSearchTopic[] } {
    const primary: MCPSearchTopic[] = [];
    const fallback: MCPSearchTopic[] = [];

    // Question type based topics
    switch (analysis.questionType) {
      case 'troubleshooting':
        primary.push('troubleshooting');
        fallback.push('general', 'reference_documentation');
        break;
      case 'technical':
        primary.push('reference_documentation');
        fallback.push('troubleshooting', 'general');
        break;
      case 'howto':
        primary.push('general');
        fallback.push('reference_documentation');
        break;
      case 'conceptual':
        primary.push('general');
        fallback.push('reference_documentation');
        break;
    }

    // Service specific topics based on AWS services
    const awsServices = analysis.awsServices.map((s: any) => s.serviceName.toLowerCase());
    
    if (awsServices.some(s => s.includes('cdk'))) {
      primary.push('cdk_docs', 'cdk_constructs');
    }
    
    if (awsServices.some(s => s.includes('cloudformation'))) {
      primary.push('cloudformation');
    }
    
    if (awsServices.some(s => s.includes('amplify'))) {
      primary.push('amplify_docs');
    }

    // Always include general as fallback if not already present
    if (!primary.includes('general')) {
      primary.push('general');
    }

    return { primary, fallback };
  }

  private async executeSearchStrategy(
    question: string,
    strategy: SearchStrategy
  ): Promise<MCPSearchResult[]> {
    const allResults: MCPSearchResult[] = [];

    try {
      // Execute primary search
      const primaryResults = await this.searchWithTopics(
        question,
        strategy.primaryTopics,
        Math.ceil(strategy.maxResults * 0.7)
      );

      allResults.push(...primaryResults);

      // If we don't have enough results, try fallback topics
      if (allResults.length < strategy.maxResults / 2 && strategy.fallbackTopics.length > 0) {
        logger.info('Primary search yielded few results, trying fallback topics', {
          primaryCount: allResults.length,
          fallbackTopics: strategy.fallbackTopics
        });

        const fallbackResults = await this.searchWithTopics(
          question,
          strategy.fallbackTopics,
          strategy.maxResults - allResults.length
        );

        allResults.push(...fallbackResults);
      }

      return allResults;

    } catch (error) {
      logger.error('Search strategy execution failed', {
        error: getErrorMessage(error),
        strategy
      });
      throw error;
    }
  }

  private async searchWithTopics(
    question: string,
    topics: MCPSearchTopic[],
    maxResults: number
  ): Promise<MCPSearchResult[]> {
    const searchResponse = await mcpService.intelligentSearch(question, {
      topics,
      limit: maxResults
    });

    if (!searchResponse.success) {
      throw new Error(searchResponse.error || 'MCP search failed');
    }

    return searchResponse.results;
  }

  private rankResults(
    results: MCPSearchResult[],
    analysis: QuestionAnalysis,
    question: string
  ): SearchResultRanking[] {
    return results.map(result => {
      const ranking = this.calculateResultRanking(result, analysis, question);
      return {
        result,
        relevanceScore: ranking.relevanceScore,
        serviceMatch: ranking.serviceMatch,
        titleMatch: ranking.titleMatch,
        contextMatch: ranking.contextMatch,
        qualityScore: ranking.qualityScore,
        finalScore: ranking.finalScore
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  private calculateResultRanking(
    result: MCPSearchResult,
    analysis: QuestionAnalysis,
    question: string
  ): SearchResultRanking {
    let relevanceScore = 0.5; // Base score
    let serviceMatch = false;
    let titleMatch = false;
    let contextMatch = false;

    const questionLower = question.toLowerCase();
    const titleLower = result.title.toLowerCase();
    const contextLower = result.context.toLowerCase();

    // AWS service matching
    for (const service of analysis.awsServices) {
      if (titleLower.includes(service.serviceName.toLowerCase()) ||
          contextLower.includes(service.serviceName.toLowerCase())) {
        serviceMatch = true;
        relevanceScore += 0.3;
        break;
      }
    }

    // Title keyword matching
    const questionWords = questionLower.split(/\s+/).filter(word => word.length > 3);
    const titleWords = titleLower.split(/\s+/);
    
    const titleMatches = questionWords.filter(word => titleWords.includes(word)).length;
    if (titleMatches > 0) {
      titleMatch = true;
      relevanceScore += (titleMatches / questionWords.length) * 0.2;
    }

    // Context keyword matching
    const contextWords = contextLower.split(/\s+/);
    const contextMatches = questionWords.filter(word => contextWords.includes(word)).length;
    if (contextMatches > 0) {
      contextMatch = true;
      relevanceScore += (contextMatches / questionWords.length) * 0.1;
    }

    // Quality indicators
    let qualityScore = 0.5;
    
    // Prefer official AWS documentation
    if (result.url.includes('docs.aws.amazon.com')) {
      qualityScore += 0.3;
    }
    
    // Prefer recent content (if timestamp available)
    if (result.url.includes('latest') || result.url.includes('current')) {
      qualityScore += 0.1;
    }

    // Penalize very short contexts
    if (result.context.length < 50) {
      qualityScore -= 0.1;
    }

    const finalScore = (relevanceScore * 0.7) + (qualityScore * 0.3);

    return {
      result,
      relevanceScore,
      serviceMatch,
      titleMatch,
      contextMatch,
      qualityScore,
      finalScore: Math.min(Math.max(finalScore, 0), 1)
    };
  }

  private applyResultLimits(
    rankedResults: SearchResultRanking[],
    maxResults: number
  ): SearchResultRanking[] {
    return rankedResults.slice(0, maxResults);
  }

  private async enhanceResults(
    rankedResults: SearchResultRanking[],
    analysis: QuestionAnalysis
  ): Promise<SearchResultRanking[]> {
    // Add any additional metadata or processing
    return rankedResults.map(ranking => ({
      ...ranking,
      result: {
        ...ranking.result,
        enhanced: true,
        relevanceScore: ranking.finalScore
      }
    }));
  }

  private async getCommonQuestions(serviceName: string): Promise<string[]> {
    try {
      const db = databaseManager.getDatabase();
      const questions = db.prepare(`
        SELECT suggestion_text 
        FROM question_suggestions 
        WHERE category = ? OR category = 'general'
        ORDER BY priority DESC, suggestion_text
        LIMIT 5
      `).all(serviceName.toLowerCase()) as Array<{ suggestion_text: string }>;

      return questions.map(q => q.suggestion_text);
    } catch (error) {
      logger.error('Failed to get common questions from database', {
        error: getErrorMessage(error),
        serviceName
      });
      return [];
    }
  }

  private async getDatabaseSuggestions(partialQuestion: string, limit: number): Promise<string[]> {
    try {
      const db = databaseManager.getDatabase();
      const suggestions = db.prepare(`
        SELECT suggestion_text 
        FROM question_suggestions 
        WHERE suggestion_text LIKE ? 
        ORDER BY priority DESC
        LIMIT ?
      `).all(`%${partialQuestion}%`, limit) as Array<{ suggestion_text: string }>;

      return suggestions.map(s => s.suggestion_text);
    } catch (error) {
      logger.error('Failed to get database suggestions', {
        error: getErrorMessage(error),
        partialQuestion: partialQuestion.substring(0, 50)
      });
      return [];
    }
  }

  private async storeSearchAnalytics(result: DocumentationSearchResult): Promise<void> {
    try {
      const db = databaseManager.getDatabase();
      
      db.prepare(`
        INSERT INTO search_analytics (
          session_id, question, question_type, aws_services,
          search_topics, response_time, success, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        result.sessionId,
        result.question,
        result.questionAnalysis.questionType,
        JSON.stringify(result.questionAnalysis.awsServices.map((s: any) => s.serviceName)),
        JSON.stringify(result.metadata.searchTopics),
        result.processingTime,
        result.success ? 1 : 0,
        new Date().toISOString()
      );

    } catch (error) {
      logger.error('Failed to store search analytics', {
        error: getErrorMessage(error),
        searchId: result.searchId
      });
      // Don't throw - analytics failure shouldn't break search
    }
  }

  private calculatePerformanceMetrics(startTime: number, resultCount: number): SearchPerformanceMetrics {
    const processingTime = Date.now() - startTime;
    
    return {
      processingTime,
      resultCount,
      averageTimePerResult: resultCount > 0 ? processingTime / resultCount : 0,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  private calculateCacheHitRate(): number {
    // This would be tracked over time in a real implementation
    return 0.0; // Placeholder
  }

  private createDefaultStrategy(): SearchStrategy {
    return {
      primaryTopics: ['general'],
      fallbackTopics: [],
      maxResults: 10,
      timeout: this.DEFAULT_TIMEOUT,
      parallelSearch: true,
      useCache: true
    };
  }
}

// Create singleton instance
export const documentationSearchService = new DocumentationSearchService();
export default documentationSearchService;