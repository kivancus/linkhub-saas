import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';
import {
  MCPSearchTopic,
  MCPSearchResult,
  MCPSearchResponse,
  MCPDocumentationContent,
  MCPRecommendationsResponse,
  MCPRegionalAvailability,
  MCPRegion,
  MCPClientConfig,
  MCPSearchOptions,
  MCPResponse,
  MCPError,
  MCPCacheEntry
} from '../types/mcp';

/**
 * Circuit Breaker States
 */
enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

/**
 * Circuit Breaker Configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  recoveryTimeout: number;     // Time to wait before trying half-open
  successThreshold: number;    // Successes needed in half-open to close circuit
  monitoringWindow: number;    // Time window for failure counting
}

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private failures: number[] = []; // Timestamps of failures within monitoring window

  constructor(private config: CircuitBreakerConfig) {}

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.config.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN - failing fast');
      } else {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.failures = [];

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        logger.info('Circuit breaker CLOSED - service recovered');
      }
    }
  }

  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures.push(now);

    // Clean old failures outside monitoring window
    this.failures = this.failures.filter(
      timestamp => now - timestamp < this.config.monitoringWindow
    );

    this.failureCount = this.failures.length;

    if (this.state === CircuitBreakerState.CLOSED && 
        this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn('Circuit breaker OPENED due to failures', {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold
      });
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn('Circuit breaker returned to OPEN from HALF_OPEN');
    }
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }

  public getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
      recentFailures: this.failures.length
    };
  }

  public reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.failures = [];
    logger.info('Circuit breaker manually reset');
  }
}

/**
 * Real MCP Client for AWS Documentation Server Integration
 * 
 * This client connects to the real AWS Documentation MCP server through
 * the cloud-architect power system to provide access to actual AWS documentation.
 * 
 * Features:
 * - Exponential backoff retry logic
 * - Circuit breaker pattern for server protection
 * - Comprehensive error logging and diagnostics
 * - Graceful fallback mechanisms with user notification
 * 
 * Replaces the previous mock implementation with real MCP server calls.
 */
class RealMCPClient {
  private config: MCPClientConfig;
  private cache: Map<string, MCPCacheEntry> = new Map();
  private connectionHealthy = false;
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 1000; // 1 second base delay
  
  // Circuit breaker for connection resilience
  private circuitBreaker: CircuitBreaker;
  
  // Error tracking for diagnostics
  private errorHistory: Array<{
    timestamp: number;
    operation: string;
    error: string;
    retryAttempt: number;
  }> = [];
  private readonly MAX_ERROR_HISTORY = 100;

  constructor(config: MCPClientConfig = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      maxConcurrentRequests: config.maxConcurrentRequests || 5,
      ...config
    };

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,        // Open circuit after 5 failures
      recoveryTimeout: 60000,     // Wait 1 minute before trying half-open
      successThreshold: 3,        // Need 3 successes to close circuit
      monitoringWindow: 300000    // Monitor failures over 5 minutes
    });

    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // Every 5 minutes
    
    // Start error history cleanup interval
    setInterval(() => this.cleanupErrorHistory(), 10 * 60 * 1000); // Every 10 minutes
    
    // Initialize connection health check
    this.performHealthCheck();
  }

  /**
   * Test connection to the real MCP server with circuit breaker protection
   */
  public async testConnection(): Promise<MCPResponse<{ status: string; version?: string }>> {
    const startTime = Date.now();

    try {
      // Use circuit breaker to protect against repeated failures
      const result = await this.circuitBreaker.execute(async () => {
        // Test connection by performing a simple search
        const testResponse = await this.callKiroPower('awsknowledge', 'aws___search_documentation', {
          search_phrase: 'AWS Lambda',
          topics: ['general'],
          limit: 1
        });

        if (!testResponse || testResponse.length === 0) {
          throw new Error('Empty response from MCP server');
        }

        return testResponse;
      });

      this.connectionHealthy = true;
      this.lastHealthCheck = Date.now();
      this.retryCount = 0;

      logger.info('Real MCP server connection test successful', {
        responseTime: Date.now() - startTime,
        circuitBreakerState: this.circuitBreaker.getState()
      });

      return {
        success: true,
        data: {
          status: 'connected',
          version: 'real-aws-documentation-server'
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      this.connectionHealthy = false;
      
      // Record error for diagnostics
      this.recordError('testConnection', getErrorMessage(error), 0);
      
      logger.error('Real MCP server connection test failed', {
        error: getErrorMessage(error),
        responseTime: Date.now() - startTime,
        circuitBreakerState: this.circuitBreaker.getState()
      });

      return {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: this.getEnhancedErrorMessage(error, 'connection test')
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check if connection is healthy
   */
  public isConnected(): boolean {
    const now = Date.now();
    if (now - this.lastHealthCheck > this.HEALTH_CHECK_INTERVAL) {
      // Trigger background health check
      this.performHealthCheck();
    }
    return this.connectionHealthy;
  }

  /**
   * Get connection health status with enhanced diagnostics
   */
  public async getHealthStatus(): Promise<{
    connected: boolean;
    lastCheck: Date;
    retryCount: number;
    circuitBreaker: any;
    recentErrors: number;
    serverInfo?: any;
  }> {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < 300000 // Last 5 minutes
    ).length;

    return {
      connected: this.connectionHealthy,
      lastCheck: new Date(this.lastHealthCheck),
      retryCount: this.retryCount,
      circuitBreaker: this.circuitBreaker.getStats(),
      recentErrors,
      serverInfo: this.connectionHealthy ? {
        server: 'aws-documentation-mcp-server',
        powerName: 'cloud-architect',
        serverName: 'awsknowledge'
      } : undefined
    };
  }

  /**
   * Search AWS documentation with circuit breaker protection and enhanced error handling
   */
  public async searchDocumentation(
    searchPhrase: string,
    options: MCPSearchOptions = {}
  ): Promise<MCPResponse<MCPSearchResult[]>> {
    const startTime = Date.now();
    
    try {
      // Default search options
      const searchOptions = {
        topics: options.topics || ['general'],
        limit: options.limit || 10,
        ...options
      };

      // Check cache first
      const cacheKey = this.generateCacheKey('search', searchPhrase, searchOptions);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug('Real MCP search cache hit', { searchPhrase, cacheKey });
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        };
      }

      // Use circuit breaker to protect against server failures
      const results = await this.circuitBreaker.execute(async () => {
        return await this.callKiroPower('awsknowledge', 'aws___search_documentation', {
          search_phrase: searchPhrase,
          topics: searchOptions.topics,
          limit: searchOptions.limit
        });
      });

      // Cache the results
      this.setCache(cacheKey, results, 5 * 60 * 1000); // Cache for 5 minutes

      logger.info('Real MCP documentation search completed', {
        searchPhrase,
        topics: searchOptions.topics,
        resultCount: results.length,
        responseTime: Date.now() - startTime,
        circuitBreakerState: this.circuitBreaker.getState()
      });

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      // Record error for diagnostics
      this.recordError('searchDocumentation', getErrorMessage(error), 0);
      
      logger.error('Real MCP documentation search failed', {
        error: getErrorMessage(error),
        searchPhrase,
        options,
        circuitBreakerState: this.circuitBreaker.getState()
      });

      // Try to provide cached fallback if available
      const fallbackResult = await this.tryFallbackSearch(searchPhrase, options);
      if (fallbackResult) {
        logger.info('Providing fallback search results from cache', {
          searchPhrase,
          resultCount: fallbackResult.length
        });
        
        return {
          success: true,
          data: fallbackResult,
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          fallback: true,
          warning: 'Results may not be current due to server connectivity issues'
        };
      }

      return {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: this.getEnhancedErrorMessage(error, 'documentation search')
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Read specific AWS documentation page using real MCP server
   */
  public async readDocumentation(
    url: string,
    options: { maxLength?: number; startIndex?: number } = {}
  ): Promise<MCPResponse<MCPDocumentationContent>> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey('read', url, options);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        };
      }

      // Call real MCP server
      const content = await this.callKiroPower('awsknowledge', 'aws___read_documentation', {
        url,
        max_length: options.maxLength,
        start_index: options.startIndex
      });

      // Cache the content
      this.setCache(cacheKey, content, 10 * 60 * 1000); // Cache for 10 minutes

      logger.info('Real MCP documentation read completed', {
        url,
        contentLength: content.content.length,
        responseTime: Date.now() - startTime
      });

      return {
        success: true,
        data: content,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Real MCP documentation read failed', {
        error: getErrorMessage(error),
        url
      });

      return {
        success: false,
        error: {
          code: 'READ_FAILED',
          message: getErrorMessage(error)
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get recommendations for related documentation using real MCP server
   */
  public async getRecommendations(url: string): Promise<MCPResponse<MCPRecommendationsResponse>> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateCacheKey('recommendations', url);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        };
      }

      const recommendations = await this.callKiroPower('awsknowledge', 'aws___recommend', {
        url
      });

      this.setCache(cacheKey, recommendations, 15 * 60 * 1000); // Cache for 15 minutes

      return {
        success: true,
        data: recommendations,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Real MCP recommendations failed', {
        error: getErrorMessage(error),
        url
      });

      return {
        success: false,
        error: {
          code: 'RECOMMENDATIONS_FAILED',
          message: getErrorMessage(error)
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check AWS service regional availability using real MCP server
   */
  public async getRegionalAvailability(
    resourceType: 'product' | 'api' | 'cfn',
    region: string,
    filters?: string[]
  ): Promise<MCPResponse<MCPRegionalAvailability[]>> {
    const startTime = Date.now();

    try {
      const availability = await this.callKiroPower('awsknowledge', 'aws___get_regional_availability', {
        resource_type: resourceType,
        region,
        filters
      });

      return {
        success: true,
        data: availability,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Real MCP regional availability check failed', {
        error: getErrorMessage(error),
        resourceType,
        region
      });

      return {
        success: false,
        error: {
          code: 'REGIONAL_CHECK_FAILED',
          message: getErrorMessage(error)
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get list of AWS regions using real MCP server
   */
  public async listRegions(): Promise<MCPResponse<MCPRegion[]>> {
    const startTime = Date.now();

    try {
      const cacheKey = 'regions_list';
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        };
      }

      const regions = await this.callKiroPower('awsknowledge', 'aws___list_regions', {});
      this.setCache(cacheKey, regions, 60 * 60 * 1000); // Cache for 1 hour

      return {
        success: true,
        data: regions,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Real MCP list regions failed', {
        error: getErrorMessage(error)
      });

      return {
        success: false,
        error: {
          code: 'LIST_REGIONS_FAILED',
          message: getErrorMessage(error)
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Call Kiro Power with enhanced retry logic and error handling
   */
  private async callKiroPower(
    serverName: string,
    toolName: string,
    arguments_: any,
    retryAttempt = 0
  ): Promise<any> {
    try {
      // Make actual call to Kiro Powers API
      const response = await this.makeRealKiroPowerCall(serverName, toolName, arguments_);
      
      // Reset retry count on success
      this.retryCount = 0;
      return response;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      
      // Record error for diagnostics
      this.recordError(`${serverName}.${toolName}`, errorMessage, retryAttempt);
      
      // Implement exponential backoff retry logic
      if (retryAttempt < this.MAX_RETRIES) {
        const delay = this.calculateBackoffDelay(retryAttempt);
        
        logger.warn('MCP server call failed, retrying with exponential backoff', {
          serverName,
          toolName,
          attempt: retryAttempt + 1,
          maxRetries: this.MAX_RETRIES,
          delay,
          error: errorMessage
        });

        await this.delay(delay);
        return this.callKiroPower(serverName, toolName, arguments_, retryAttempt + 1);
      }

      // All retries exhausted
      this.retryCount = retryAttempt + 1;
      this.connectionHealthy = false;
      
      logger.error('MCP server call failed after all retries', {
        serverName,
        toolName,
        totalAttempts: retryAttempt + 1,
        error: errorMessage,
        errorHistory: this.getRecentErrors(5)
      });

      throw new Error(`MCP server call failed after ${retryAttempt + 1} attempts: ${errorMessage}`);
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(retryAttempt: number): number {
    const baseDelay = this.RETRY_DELAY_BASE * Math.pow(2, retryAttempt);
    const jitter = Math.random() * 0.1 * baseDelay; // Add up to 10% jitter
    const maxDelay = 30000; // Cap at 30 seconds
    
    return Math.min(baseDelay + jitter, maxDelay);
  }

  /**
   * Record error for diagnostics and monitoring
   */
  private recordError(operation: string, error: string, retryAttempt: number): void {
    this.errorHistory.push({
      timestamp: Date.now(),
      operation,
      error,
      retryAttempt
    });

    // Keep error history size manageable
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory = this.errorHistory.slice(-this.MAX_ERROR_HISTORY);
    }
  }

  /**
   * Get recent errors for diagnostics
   */
  private getRecentErrors(count: number = 10): Array<{
    timestamp: Date;
    operation: string;
    error: string;
    retryAttempt: number;
  }> {
    return this.errorHistory
      .slice(-count)
      .map(error => ({
        ...error,
        timestamp: new Date(error.timestamp)
      }));
  }

  /**
   * Clean up old error history
   */
  private cleanupErrorHistory(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours
    const originalLength = this.errorHistory.length;
    
    this.errorHistory = this.errorHistory.filter(error => error.timestamp > cutoff);
    
    const cleaned = originalLength - this.errorHistory.length;
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} old error history entries`);
    }
  }

  /**
   * Get enhanced error code based on error type
   */
  private getErrorCode(error: any): string {
    const errorMessage = getErrorMessage(error).toLowerCase();
    
    if (errorMessage.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'NETWORK_ERROR';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      return 'AUTH_ERROR';
    } else if (errorMessage.includes('circuit breaker')) {
      return 'CIRCUIT_BREAKER_OPEN';
    } else if (errorMessage.includes('rate limit')) {
      return 'RATE_LIMIT_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  /**
   * Get enhanced error message with context and suggestions
   */
  private getEnhancedErrorMessage(error: any, operation: string): string {
    const baseMessage = getErrorMessage(error);
    const errorCode = this.getErrorCode(error);
    
    let enhancedMessage = `${operation} failed: ${baseMessage}`;
    
    // Add context-specific suggestions
    switch (errorCode) {
      case 'TIMEOUT_ERROR':
        enhancedMessage += '. The request timed out. Please try again or check your network connection.';
        break;
      case 'NETWORK_ERROR':
        enhancedMessage += '. Network connectivity issue detected. Please check your internet connection.';
        break;
      case 'AUTH_ERROR':
        enhancedMessage += '. Authentication failed. Please check your credentials and permissions.';
        break;
      case 'CIRCUIT_BREAKER_OPEN':
        enhancedMessage += '. Service is temporarily unavailable due to repeated failures. Please try again later.';
        break;
      case 'RATE_LIMIT_ERROR':
        enhancedMessage += '. Rate limit exceeded. Please wait before making more requests.';
        break;
      default:
        enhancedMessage += '. Please try again or contact support if the issue persists.';
    }
    
    return enhancedMessage;
  }

  /**
   * Try to provide fallback results from cache
   */
  private async tryFallbackSearch(
    searchPhrase: string,
    options: MCPSearchOptions
  ): Promise<MCPSearchResult[] | null> {
    try {
      // Look for similar cached searches
      const searchOptions = {
        topics: options.topics || ['general'],
        limit: options.limit || 10,
        ...options
      };

      // Try exact cache match first
      const exactCacheKey = this.generateCacheKey('search', searchPhrase, searchOptions);
      const exactCached = this.getFromCache(exactCacheKey);
      if (exactCached) {
        return exactCached;
      }

      // Try to find similar cached searches (fuzzy matching)
      const searchWords = searchPhrase.toLowerCase().split(/\s+/);
      for (const [cacheKey, cacheEntry] of this.cache.entries()) {
        if (cacheKey.startsWith('real_search:') && Date.now() < cacheEntry.expiresAt) {
          const cachedSearchPhrase = this.extractSearchPhraseFromCacheKey(cacheKey);
          if (cachedSearchPhrase && this.isSimilarSearch(searchWords, cachedSearchPhrase)) {
            logger.info('Using similar cached search as fallback', {
              originalSearch: searchPhrase,
              fallbackSearch: cachedSearchPhrase
            });
            return cacheEntry.data;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Fallback search failed', {
        error: getErrorMessage(error),
        searchPhrase
      });
      return null;
    }
  }

  /**
   * Extract search phrase from cache key for fallback matching
   */
  private extractSearchPhraseFromCacheKey(cacheKey: string): string | null {
    try {
      const match = cacheKey.match(/real_search:\["([^"]+)"/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if two searches are similar enough for fallback
   */
  private isSimilarSearch(searchWords: string[], cachedSearchPhrase: string): boolean {
    const cachedWords = cachedSearchPhrase.toLowerCase().split(/\s+/);
    const commonWords = searchWords.filter(word => cachedWords.includes(word));
    
    // Consider similar if at least 50% of words match
    return commonWords.length >= Math.ceil(searchWords.length * 0.5);
  }

  /**
   * Make actual call to Kiro Powers API with proper fallback handling
   */
  private async makeRealKiroPowerCall(
    serverName: string,
    toolName: string,
    arguments_: any
  ): Promise<any> {
    try {
      // Use require to avoid TypeScript import issues
      let kiroPowers: any;
      try {
        const kiroPowersModule = require('../utils/kiroPowers');
        kiroPowers = kiroPowersModule.kiroPowers || kiroPowersModule.default;
      } catch (importError) {
        logger.error('Failed to load kiroPowers module', {
          error: getErrorMessage(importError)
        });
        throw new Error('Kiro Powers module not available - real MCP server connection required');
      }
      
      logger.info('Making real MCP server call', {
        serverName,
        toolName,
        powerName: 'cloud-architect'
      });

      // Make the actual call to Kiro Powers - this will handle fallback internally
      const response = await kiroPowers.use('cloud-architect', serverName, toolName, arguments_);
      
      // Validate MCP response structure
      this.validateMCPResponse(response, toolName);
      
      logger.info('Real MCP server call successful', {
        serverName,
        toolName,
        responseType: typeof response,
        hasData: !!response
      });

      return response;

    } catch (error) {
      logger.error('Real MCP server call failed', {
        serverName,
        toolName,
        error: getErrorMessage(error)
      });
      
      // Re-throw the error to be handled by circuit breaker and retry logic
      throw error;
    }
  }

  /**
   * Validate MCP server response structure and content
   */
  private validateMCPResponse(response: any, toolName: string): void {
    if (!response) {
      throw new Error('MCP server returned null or undefined response');
    }

    // Validate response structure based on tool type
    switch (toolName) {
      case 'aws___search_documentation':
        if (!Array.isArray(response)) {
          throw new Error('Search documentation response must be an array');
        }
        
        // Validate each search result
        response.forEach((result: any, index: number) => {
          if (!result.url || !result.title || !result.context) {
            throw new Error(`Invalid search result at index ${index}: missing required fields (url, title, context)`);
          }
          
          if (typeof result.rank_order !== 'number') {
            throw new Error(`Invalid search result at index ${index}: rank_order must be a number`);
          }
          
          // Validate URL format
          if (!this.isValidAwsDocumentationUrl(result.url)) {
            logger.warn('Search result contains non-AWS documentation URL', {
              url: result.url,
              title: result.title
            });
          }
        });
        break;

      case 'aws___read_documentation':
        if (!response.content || typeof response.content !== 'string') {
          throw new Error('Read documentation response must contain content string');
        }
        
        if (response.content.length === 0) {
          throw new Error('Read documentation response contains empty content');
        }
        break;

      case 'aws___recommend':
        const requiredCategories = ['highly_rated', 'new', 'similar', 'journey'];
        for (const category of requiredCategories) {
          if (!Array.isArray(response[category])) {
            throw new Error(`Recommendations response missing or invalid category: ${category}`);
          }
        }
        break;

      case 'aws___get_regional_availability':
        if (!Array.isArray(response)) {
          throw new Error('Regional availability response must be an array');
        }
        
        response.forEach((item: any, index: number) => {
          if (!item.resource_id || !item.status || !item.region) {
            throw new Error(`Invalid availability item at index ${index}: missing required fields`);
          }
        });
        break;

      case 'aws___list_regions':
        if (!Array.isArray(response)) {
          throw new Error('List regions response must be an array');
        }
        
        response.forEach((region: any, index: number) => {
          if (!region.region_id || !region.region_long_name) {
            throw new Error(`Invalid region at index ${index}: missing required fields`);
          }
        });
        break;

      default:
        logger.warn('Unknown MCP tool - skipping response validation', { toolName });
    }

    logger.debug('MCP response validation passed', {
      toolName,
      responseSize: Array.isArray(response) ? response.length : 'N/A'
    });
  }

  /**
   * Validate if URL is from official AWS documentation
   */
  private isValidAwsDocumentationUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname === 'docs.aws.amazon.com' ||
             parsedUrl.hostname === 'aws.amazon.com' ||
             parsedUrl.hostname.endsWith('.aws.amazon.com');
    } catch {
      return false;
    }
  }

  /**
   * Perform background health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const result = await this.testConnection();
      this.connectionHealthy = result.success;
      this.lastHealthCheck = Date.now();
      
      if (!result.success) {
        logger.warn('MCP server health check failed', {
          error: result.error?.message
        });
      }
    } catch (error) {
      this.connectionHealthy = false;
      this.lastHealthCheck = Date.now();
      logger.error('MCP server health check error', {
        error: getErrorMessage(error)
      });
    }
  }

  // Cache management methods (shared with legacy client)
  
  private generateCacheKey(operation: string, ...params: any[]): string {
    return `real_${operation}:${JSON.stringify(params)}`;
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    const entry: MCPCacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      accessCount: 0
    };

    this.cache.set(key, entry);
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired cache entries from real MCP client`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    const entries = Array.from(this.cache.values());
    const totalEntries = entries.length;
    const totalAccess = entries.reduce((sum, entry) => sum + entry.accessCount, 0);

    return {
      totalEntries,
      totalAccess,
      averageAccess: totalEntries > 0 ? totalAccess / totalEntries : 0,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null,
      clientType: 'real-mcp-client'
    };
  }

  /**
   * Get comprehensive performance metrics including circuit breaker stats
   */
  public getMetrics() {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < 300000 // Last 5 minutes
    );

    return {
      connectionHealthy: this.connectionHealthy,
      lastHealthCheck: new Date(this.lastHealthCheck),
      retryCount: this.retryCount,
      maxRetries: this.MAX_RETRIES,
      circuitBreaker: this.circuitBreaker.getStats(),
      errorTracking: {
        totalErrors: this.errorHistory.length,
        recentErrors: recentErrors.length,
        errorRate: recentErrors.length / 5, // Errors per minute over last 5 minutes
        commonErrors: this.getCommonErrors(),
        lastError: this.errorHistory.length > 0 ? {
          ...this.errorHistory[this.errorHistory.length - 1],
          timestamp: new Date(this.errorHistory[this.errorHistory.length - 1].timestamp)
        } : null
      },
      cacheStats: this.getCacheStats(),
      config: {
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
        retryDelay: this.config.retryDelay,
        maxConcurrentRequests: this.config.maxConcurrentRequests
      }
    };
  }

  /**
   * Get common error patterns for diagnostics
   */
  private getCommonErrors(): Array<{ error: string; count: number; lastOccurrence: Date }> {
    const errorCounts = new Map<string, { count: number; lastTimestamp: number }>();
    
    this.errorHistory.forEach(error => {
      const key = error.error.substring(0, 100); // Truncate for grouping
      const existing = errorCounts.get(key) || { count: 0, lastTimestamp: 0 };
      errorCounts.set(key, {
        count: existing.count + 1,
        lastTimestamp: Math.max(existing.lastTimestamp, error.timestamp)
      });
    });

    return Array.from(errorCounts.entries())
      .map(([error, stats]) => ({
        error,
        count: stats.count,
        lastOccurrence: new Date(stats.lastTimestamp)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 most common errors
  }

  /**
   * Reset circuit breaker and error tracking (for administrative use)
   */
  public resetErrorTracking(): void {
    this.circuitBreaker.reset();
    this.errorHistory = [];
    this.retryCount = 0;
    this.connectionHealthy = false; // Will be updated on next health check
    
    logger.info('MCP client error tracking reset');
    
    // Trigger immediate health check
    this.performHealthCheck();
  }
}

// Create singleton instances
export const realMcpClient = new RealMCPClient({
  timeout: parseInt(process.env.MCP_SERVER_TIMEOUT || '30000'),
  retryAttempts: 3,
  retryDelay: 1000,
  maxConcurrentRequests: 5
});

// Use real MCP client by default
export const mcpClient = realMcpClient;

export default mcpClient;