import { mcpClient } from './mcpClient';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';
import {
  MCPSearchTopic,
  MCPSearchResult,
  MCPSearchOptions,
  QuestionAnalysis,
  SearchStrategy
} from '../types/mcp';

/**
 * High-level MCP service that provides intelligent search strategies
 * and question analysis for AWS documentation queries
 */
class MCPService {
  
  /**
   * Analyze a user question to determine the best search strategy
   */
  public analyzeQuestion(question: string): QuestionAnalysis {
    const questionLower = question.toLowerCase();
    
    // Identify question type
    let questionType: QuestionAnalysis['questionType'] = 'conceptual';
    
    if (questionLower.includes('how to') || questionLower.includes('how do i')) {
      questionType = 'howto';
    } else if (questionLower.includes('error') || questionLower.includes('problem') || 
               questionLower.includes('issue') || questionLower.includes('troubleshoot') ||
               questionLower.includes('not working') || questionLower.includes('failed')) {
      questionType = 'troubleshooting';
    } else if (questionLower.includes('what is') || questionLower.includes('explain') ||
               questionLower.includes('difference between') || questionLower.includes('concept')) {
      questionType = 'conceptual';
    } else if (questionLower.includes('api') || questionLower.includes('cli') ||
               questionLower.includes('sdk') || questionLower.includes('code')) {
      questionType = 'technical';
    }

    // Extract AWS services mentioned
    const awsServices = this.extractAwsServices(question);
    
    // Determine complexity
    const complexity = this.assessComplexity(question, awsServices);
    
    // Suggest appropriate MCP search topics
    const suggestedTopics = this.suggestSearchTopics(questionType, question, awsServices);
    
    // Calculate confidence based on various factors
    const confidence = this.calculateConfidence(questionType, awsServices, question);

    return {
      questionType,
      awsServices,
      complexity,
      suggestedTopics,
      confidence
    };
  }

  /**
   * Perform intelligent search based on question analysis
   */
  public async intelligentSearch(
    question: string,
    options: MCPSearchOptions = {}
  ): Promise<{
    results: MCPSearchResult[];
    analysis: QuestionAnalysis;
    searchStrategy: SearchStrategy;
    success: boolean;
    error?: string;
  }> {
    try {
      // Analyze the question first
      const analysis = this.analyzeQuestion(question);
      
      // Create search strategy
      const searchStrategy = this.createSearchStrategy(analysis);
      
      // Perform primary search
      const primaryResults = await this.performSearchWithStrategy(
        question,
        searchStrategy.primaryTopics,
        Math.ceil(searchStrategy.maxResults * 0.7)
      );

      let allResults = primaryResults;

      // If primary search didn't yield enough results, try fallback topics
      if (primaryResults.length < searchStrategy.maxResults / 2 && 
          searchStrategy.fallbackTopics.length > 0) {
        
        logger.info('Primary search yielded few results, trying fallback topics', {
          primaryCount: primaryResults.length,
          fallbackTopics: searchStrategy.fallbackTopics
        });

        const fallbackResults = await this.performSearchWithStrategy(
          question,
          searchStrategy.fallbackTopics,
          searchStrategy.maxResults - primaryResults.length
        );

        allResults = [...primaryResults, ...fallbackResults];
      }

      // Remove duplicates and sort by relevance
      const uniqueResults = this.deduplicateResults(allResults);
      const sortedResults = this.sortResultsByRelevance(uniqueResults, analysis);

      logger.info('Intelligent search completed', {
        question: question.substring(0, 100),
        questionType: analysis.questionType,
        awsServices: analysis.awsServices,
        resultCount: sortedResults.length,
        searchTopics: searchStrategy.primaryTopics
      });

      return {
        results: sortedResults.slice(0, searchStrategy.maxResults),
        analysis,
        searchStrategy,
        success: true
      };

    } catch (error) {
      logger.error('Intelligent search failed', {
        error: getErrorMessage(error),
        question: question.substring(0, 100)
      });

      return {
        results: [],
        analysis: this.analyzeQuestion(question),
        searchStrategy: this.createDefaultStrategy(),
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * Get documentation content with intelligent caching
   */
  public async getDocumentationContent(url: string, maxLength?: number) {
    try {
      const response = await mcpClient.readDocumentation(url, { maxLength });
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to read documentation');
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get documentation content', {
        error: getErrorMessage(error),
        url
      });
      throw error;
    }
  }

  /**
   * Get related documentation recommendations
   */
  public async getRelatedDocumentation(url: string) {
    try {
      const response = await mcpClient.getRecommendations(url);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get recommendations');
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get related documentation', {
        error: getErrorMessage(error),
        url
      });
      throw error;
    }
  }

  /**
   * Check if AWS services are available in a specific region
   */
  public async checkServiceAvailability(services: string[], region: string) {
    try {
      const response = await mcpClient.getRegionalAvailability('product', region, services);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to check availability');
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to check service availability', {
        error: getErrorMessage(error),
        services,
        region
      });
      throw error;
    }
  }

  /**
   * Test MCP server connectivity
   */
  public async testConnection() {
    try {
      const response = await mcpClient.testConnection();
      return response;
    } catch (error) {
      logger.error('MCP connection test failed', {
        error: getErrorMessage(error)
      });
      throw error;
    }
  }

  // Private helper methods

  private extractAwsServices(question: string): string[] {
    const services: string[] = [];
    const questionLower = question.toLowerCase();

    // Common AWS service patterns
    const servicePatterns = [
      { pattern: /\b(ec2|elastic compute cloud)\b/i, service: 'EC2' },
      { pattern: /\b(s3|simple storage service)\b/i, service: 'S3' },
      { pattern: /\b(lambda|aws lambda)\b/i, service: 'Lambda' },
      { pattern: /\b(rds|relational database service)\b/i, service: 'RDS' },
      { pattern: /\b(dynamodb|dynamo db)\b/i, service: 'DynamoDB' },
      { pattern: /\b(vpc|virtual private cloud)\b/i, service: 'VPC' },
      { pattern: /\b(iam|identity and access management)\b/i, service: 'IAM' },
      { pattern: /\b(cloudformation|cloud formation)\b/i, service: 'CloudFormation' },
      { pattern: /\b(cdk|cloud development kit)\b/i, service: 'CDK' },
      { pattern: /\b(ecs|elastic container service)\b/i, service: 'ECS' },
      { pattern: /\b(eks|elastic kubernetes service)\b/i, service: 'EKS' },
      { pattern: /\b(cloudwatch|cloud watch)\b/i, service: 'CloudWatch' },
      { pattern: /\b(sns|simple notification service)\b/i, service: 'SNS' },
      { pattern: /\b(sqs|simple queue service)\b/i, service: 'SQS' },
      { pattern: /\b(api gateway|apigateway)\b/i, service: 'API Gateway' },
      { pattern: /\b(route 53|route53)\b/i, service: 'Route 53' },
      { pattern: /\b(cloudfront|cloud front)\b/i, service: 'CloudFront' },
      { pattern: /\b(amplify)\b/i, service: 'Amplify' },
      { pattern: /\b(cognito)\b/i, service: 'Cognito' },
      { pattern: /\b(kinesis)\b/i, service: 'Kinesis' },
      { pattern: /\b(redshift)\b/i, service: 'Redshift' },
      { pattern: /\b(aurora)\b/i, service: 'Aurora' },
      { pattern: /\b(elasticache|elastic cache)\b/i, service: 'ElastiCache' }
    ];

    for (const { pattern, service } of servicePatterns) {
      if (pattern.test(question)) {
        services.push(service);
      }
    }

    return [...new Set(services)]; // Remove duplicates
  }

  private assessComplexity(question: string, awsServices: string[]): 'simple' | 'moderate' | 'complex' {
    let complexityScore = 0;

    // Multiple services increase complexity
    complexityScore += awsServices.length * 2;

    // Long questions are often more complex
    if (question.length > 200) complexityScore += 3;
    else if (question.length > 100) complexityScore += 1;

    // Technical terms increase complexity
    const technicalTerms = [
      'integration', 'architecture', 'deployment', 'configuration',
      'security', 'performance', 'scaling', 'monitoring', 'troubleshooting',
      'best practices', 'optimization', 'automation', 'infrastructure'
    ];

    for (const term of technicalTerms) {
      if (question.toLowerCase().includes(term)) {
        complexityScore += 1;
      }
    }

    // Multiple questions or steps
    if (question.includes('?') && question.split('?').length > 2) {
      complexityScore += 2;
    }

    if (complexityScore <= 3) return 'simple';
    if (complexityScore <= 7) return 'moderate';
    return 'complex';
  }

  private suggestSearchTopics(
    questionType: QuestionAnalysis['questionType'],
    question: string,
    awsServices: string[]
  ): MCPSearchTopic[] {
    const topics: MCPSearchTopic[] = [];
    const questionLower = question.toLowerCase();

    // Primary topic based on question type
    switch (questionType) {
      case 'troubleshooting':
        topics.push('troubleshooting');
        break;
      case 'technical':
        if (questionLower.includes('api') || questionLower.includes('cli') || questionLower.includes('sdk')) {
          topics.push('reference_documentation');
        }
        break;
      case 'howto':
        topics.push('general');
        break;
      case 'conceptual':
        topics.push('general');
        break;
    }

    // Add specific topics based on content
    if (questionLower.includes('cdk') || questionLower.includes('cloud development kit')) {
      if (questionLower.includes('example') || questionLower.includes('construct')) {
        topics.push('cdk_constructs');
      } else {
        topics.push('cdk_docs');
      }
    }

    if (questionLower.includes('cloudformation') || questionLower.includes('template')) {
      topics.push('cloudformation');
    }

    if (questionLower.includes('amplify')) {
      topics.push('amplify_docs');
    }

    if (questionLower.includes('new') || questionLower.includes('latest') || 
        questionLower.includes('recent') || questionLower.includes('announcement')) {
      topics.push('current_awareness');
    }

    // Always include general as fallback
    if (!topics.includes('general')) {
      topics.push('general');
    }

    return topics;
  }

  private calculateConfidence(
    questionType: QuestionAnalysis['questionType'],
    awsServices: string[],
    question: string
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for recognized AWS services
    confidence += awsServices.length * 0.1;

    // Higher confidence for clear question types
    if (questionType === 'technical' || questionType === 'troubleshooting' || 
        questionType === 'howto' || questionType === 'conceptual') {
      confidence += 0.2;
    }

    // Higher confidence for specific questions
    if (question.length > 20 && question.length < 200) {
      confidence += 0.1;
    }

    // Lower confidence for very vague questions
    if (question.length < 10) {
      confidence -= 0.3;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private createSearchStrategy(analysis: QuestionAnalysis): SearchStrategy {
    const baseStrategy: SearchStrategy = {
      primaryTopics: analysis.suggestedTopics,
      fallbackTopics: ['general'],
      maxResults: 10,
      timeout: 30000
    };

    // Adjust based on complexity
    switch (analysis.complexity) {
      case 'simple':
        baseStrategy.maxResults = 5;
        baseStrategy.timeout = 15000;
        break;
      case 'complex':
        baseStrategy.maxResults = 15;
        baseStrategy.timeout = 45000;
        baseStrategy.fallbackTopics = ['general', 'reference_documentation'];
        break;
    }

    // Add fallback topics that aren't already in primary
    baseStrategy.fallbackTopics = baseStrategy.fallbackTopics.filter(
      topic => !baseStrategy.primaryTopics.includes(topic)
    );

    return baseStrategy;
  }

  private createDefaultStrategy(): SearchStrategy {
    return {
      primaryTopics: ['general'],
      fallbackTopics: [],
      maxResults: 10,
      timeout: 30000
    };
  }

  private async performSearchWithStrategy(
    question: string,
    topics: MCPSearchTopic[],
    maxResults: number
  ): Promise<MCPSearchResult[]> {
    const response = await mcpClient.searchDocumentation(question, {
      topics,
      limit: maxResults
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Search failed');
    }

    return response.data || [];
  }

  private deduplicateResults(results: MCPSearchResult[]): MCPSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.url)) {
        return false;
      }
      seen.add(result.url);
      return true;
    });
  }

  private sortResultsByRelevance(
    results: MCPSearchResult[],
    analysis: QuestionAnalysis
  ): MCPSearchResult[] {
    return results.sort((a, b) => {
      // Primary sort by rank_order (lower is better)
      if (a.rank_order !== b.rank_order) {
        return a.rank_order - b.rank_order;
      }

      // Secondary sort by AWS service relevance
      const aServiceMatch = analysis.awsServices.some(service => 
        a.title.toLowerCase().includes(service.toLowerCase()) ||
        a.context.toLowerCase().includes(service.toLowerCase())
      );
      const bServiceMatch = analysis.awsServices.some(service => 
        b.title.toLowerCase().includes(service.toLowerCase()) ||
        b.context.toLowerCase().includes(service.toLowerCase())
      );

      if (aServiceMatch && !bServiceMatch) return -1;
      if (!aServiceMatch && bServiceMatch) return 1;

      return 0;
    });
  }

  /**
   * Get MCP service statistics
   */
  public getStats() {
    return {
      cache: mcpClient.getCacheStats(),
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
export const mcpService = new MCPService();
export default mcpService;