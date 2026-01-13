import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { databaseManager } from '../database/connection';
import {
  Question,
  QuestionAnalysis,
  QuestionValidation,
  QuestionNormalization,
  QuestionSuggestion,
  QuestionProcessingResult,
  QuestionType,
  QuestionComplexity,
  QuestionIntent,
  AwsServiceReference,
  ExtractedEntity,
  EntityType,
  ValidationError,
  ValidationWarning,
  NormalizationChange,
  QuestionEngineConfig,
  QuestionMetadata
} from '../types/question';

/**
 * Advanced Question Engine for AWS Knowledge Hub
 * 
 * Provides comprehensive question processing including:
 * - Question validation and normalization
 * - AWS service and entity extraction
 * - Question classification and intent analysis
 * - Complexity assessment and confidence scoring
 * - Suggestion generation for unclear questions
 */
class QuestionEngine {
  private config: QuestionEngineConfig;
  private awsServicePatterns: Map<string, RegExp> = new Map();
  private entityPatterns: Map<EntityType, RegExp> = new Map();
  private questionTypePatterns: Map<QuestionType, RegExp[]> = new Map();

  constructor(config: Partial<QuestionEngineConfig> = {}) {
    this.config = {
      minQuestionLength: 5,
      maxQuestionLength: 1000,
      enableSpellCheck: true,
      enableProfanityFilter: true,
      confidenceThreshold: 0.6,
      supportedLanguages: ['en'],
      awsServiceDatabase: 'aws_services',
      ...config
    };

    this.initializePatterns();
  }

  /**
   * Process a user question through the complete analysis pipeline
   */
  public async processQuestion(
    questionText: string,
    sessionId: string,
    metadata: QuestionMetadata = {}
  ): Promise<QuestionProcessingResult> {
    const startTime = Date.now();

    try {
      // Create question object
      const question: Question = {
        id: uuidv4(),
        sessionId,
        originalText: questionText,
        normalizedText: questionText,
        language: 'en', // TODO: Implement language detection
        timestamp: new Date(),
        metadata
      };

      // Step 1: Validate question
      const validation = await this.validateQuestion(questionText);
      if (!validation.isValid) {
        return {
          question,
          analysis: this.createEmptyAnalysis(question.id),
          validation,
          normalization: { original: questionText, normalized: questionText, changes: [] },
          suggestions: await this.generateSuggestions(questionText, validation),
          processingTime: Date.now() - startTime,
          success: false,
          error: validation.errors[0]?.message || 'Question validation failed'
        };
      }

      // Step 2: Normalize question
      const normalization = await this.normalizeQuestion(questionText);
      question.normalizedText = normalization.normalized;

      // Step 3: Analyze question
      const analysis = await this.analyzeQuestion(question);

      // Step 4: Generate suggestions if needed
      const suggestions = await this.generateSuggestions(
        question.normalizedText, 
        validation, 
        analysis
      );

      const processingTime = Date.now() - startTime;

      logger.info('Question processed successfully', {
        questionId: question.id,
        sessionId,
        questionType: analysis.questionType,
        awsServices: analysis.awsServices.map(s => s.serviceName),
        complexity: analysis.complexity,
        confidence: analysis.confidence,
        processingTime
      });

      return {
        question,
        analysis,
        validation,
        normalization,
        suggestions,
        processingTime,
        success: true
      };

    } catch (error) {
      logger.error('Question processing failed', {
        error: getErrorMessage(error),
        questionText: questionText.substring(0, 100),
        sessionId
      });

      return {
        question: {
          id: uuidv4(),
          sessionId,
          originalText: questionText,
          normalizedText: questionText,
          language: 'en',
          timestamp: new Date(),
          metadata
        },
        analysis: this.createEmptyAnalysis(uuidv4()),
        validation: { 
          isValid: false, 
          isAwsRelated: false,
          hasMinimumLength: false,
          hasMaximumLength: true,
          containsOffensiveContent: false,
          language: 'en',
          errors: [{ code: 'PROCESSING_ERROR', message: getErrorMessage(error), severity: 'error' }],
          warnings: []
        },
        normalization: { original: questionText, normalized: questionText, changes: [] },
        suggestions: [],
        processingTime: Date.now() - startTime,
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * Validate question for basic requirements and AWS relevance
   */
  private async validateQuestion(questionText: string): Promise<QuestionValidation> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Length validation
    const hasMinimumLength = questionText.trim().length >= this.config.minQuestionLength;
    const hasMaximumLength = questionText.length <= this.config.maxQuestionLength;

    if (!hasMinimumLength) {
      errors.push({
        code: 'QUESTION_TOO_SHORT',
        message: `Question must be at least ${this.config.minQuestionLength} characters long`,
        severity: 'error'
      });
    }

    if (!hasMaximumLength) {
      errors.push({
        code: 'QUESTION_TOO_LONG',
        message: `Question must be no more than ${this.config.maxQuestionLength} characters long`,
        severity: 'error'
      });
    }

    // AWS relevance check
    const isAwsRelated = await this.checkAwsRelevance(questionText);
    if (!isAwsRelated) {
      warnings.push({
        code: 'NOT_AWS_RELATED',
        message: 'Question does not appear to be related to AWS services',
        suggestion: 'Try mentioning specific AWS services like EC2, S3, Lambda, etc.'
      });
    }

    // Profanity check (basic implementation)
    const containsOffensiveContent = this.config.enableProfanityFilter && 
      this.checkOffensiveContent(questionText);

    if (containsOffensiveContent) {
      errors.push({
        code: 'OFFENSIVE_CONTENT',
        message: 'Question contains inappropriate content',
        severity: 'error'
      });
    }

    // Language detection (simplified)
    const language = this.detectLanguage(questionText);
    if (!this.config.supportedLanguages.includes(language)) {
      warnings.push({
        code: 'UNSUPPORTED_LANGUAGE',
        message: `Detected language '${language}' is not fully supported`,
        suggestion: 'For best results, please ask questions in English'
      });
    }

    return {
      isValid: errors.length === 0,
      isAwsRelated,
      hasMinimumLength,
      hasMaximumLength,
      containsOffensiveContent,
      language,
      errors,
      warnings
    };
  }

  /**
   * Normalize question text (spelling, abbreviations, formatting)
   */
  private async normalizeQuestion(questionText: string): Promise<QuestionNormalization> {
    const changes: NormalizationChange[] = [];
    let normalized = questionText;

    // Normalize whitespace
    const whitespaceNormalized = normalized.replace(/\s+/g, ' ').trim();
    if (whitespaceNormalized !== normalized) {
      changes.push({
        type: 'whitespace',
        original: normalized,
        normalized: whitespaceNormalized,
        position: 0
      });
      normalized = whitespaceNormalized;
    }

    // Expand common AWS abbreviations
    const abbreviations = new Map([
      ['ec2', 'EC2'],
      ['s3', 'S3'],
      ['rds', 'RDS'],
      ['vpc', 'VPC'],
      ['iam', 'IAM'],
      ['api gw', 'API Gateway'],
      ['apigateway', 'API Gateway'],
      ['cf', 'CloudFormation'],
      ['cw', 'CloudWatch'],
      ['elb', 'Elastic Load Balancer'],
      ['alb', 'Application Load Balancer'],
      ['nlb', 'Network Load Balancer'],
      ['asg', 'Auto Scaling Group'],
      ['sg', 'Security Group'],
      ['nacl', 'Network ACL'],
      ['igw', 'Internet Gateway'],
      ['nat', 'NAT Gateway'],
      ['dx', 'Direct Connect']
    ]);

    for (const [abbrev, full] of abbreviations) {
      const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
      if (regex.test(normalized)) {
        const replaced = normalized.replace(regex, full);
        if (replaced !== normalized) {
          changes.push({
            type: 'abbreviation',
            original: abbrev,
            normalized: full,
            position: normalized.search(regex)
          });
          normalized = replaced;
        }
      }
    }

    // Basic spell check for common AWS terms
    if (this.config.enableSpellCheck) {
      const spellCorrections = new Map([
        ['lamda', 'Lambda'],
        ['dynamo', 'DynamoDB'],
        ['cloudfrount', 'CloudFront'],
        ['elasticache', 'ElastiCache'],
        ['redshit', 'Redshift'],
        ['kinesis', 'Kinesis']
      ]);

      for (const [incorrect, correct] of spellCorrections) {
        const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
        if (regex.test(normalized)) {
          const replaced = normalized.replace(regex, correct);
          if (replaced !== normalized) {
            changes.push({
              type: 'spelling',
              original: incorrect,
              normalized: correct,
              position: normalized.search(regex)
            });
            normalized = replaced;
          }
        }
      }
    }

    return {
      original: questionText,
      normalized,
      changes
    };
  }

  /**
   * Analyze question to extract services, classify type, and assess complexity
   */
  private async analyzeQuestion(question: Question): Promise<QuestionAnalysis> {
    const startTime = Date.now();

    // Extract AWS services
    const awsServices = await this.extractAwsServices(question.normalizedText);

    // Extract other entities
    const entities = this.extractEntities(question.normalizedText);

    // Classify question type
    const questionType = this.classifyQuestionType(question.normalizedText);

    // Determine intent
    const intent = this.determineIntent(question.normalizedText, questionType);

    // Assess complexity
    const complexity = this.assessComplexity(question.normalizedText, awsServices, entities);

    // Calculate confidence
    const confidence = this.calculateConfidence(questionType, awsServices, entities, question.normalizedText);

    // Generate suggested actions
    const suggestedActions = this.generateSuggestedActions(questionType, intent, awsServices);

    const processingTime = Date.now() - startTime;

    return {
      questionId: question.id,
      questionType,
      awsServices,
      complexity,
      intent,
      entities,
      confidence,
      suggestedActions,
      processingTime
    };
  }

  /**
   * Extract AWS services mentioned in the question
   */
  private async extractAwsServices(questionText: string): Promise<AwsServiceReference[]> {
    const services: AwsServiceReference[] = [];
    const questionLower = questionText.toLowerCase();

    try {
      // Get AWS services from database
      const db = databaseManager.getDatabase();
      const dbServices = db.prepare(`
        SELECT service_name, service_code, category 
        FROM aws_services 
        WHERE is_active = 1
      `).all() as Array<{ service_name: string; service_code: string; category: string }>;

      // Check each service against the question
      for (const service of dbServices) {
        const patterns = [
          new RegExp(`\\b${service.service_name.toLowerCase()}\\b`, 'i'),
          new RegExp(`\\b${service.service_code.toLowerCase()}\\b`, 'i'),
          // Handle common variations
          new RegExp(`\\b${service.service_name.replace(/^(Amazon|AWS)\s+/, '').toLowerCase()}\\b`, 'i')
        ];

        for (const pattern of patterns) {
          const match = questionText.match(pattern);
          if (match) {
            services.push({
              serviceName: service.service_name,
              serviceCode: service.service_code,
              category: service.category,
              confidence: this.calculateServiceConfidence(match, questionText),
              context: this.extractContext(questionText, match.index || 0, match[0].length)
            });
            break; // Avoid duplicates
          }
        }
      }
    } catch (error) {
      logger.error('Failed to extract AWS services from database', {
        error: getErrorMessage(error)
      });

      // Fallback to hardcoded patterns
      return this.extractAwsServicesFromPatterns(questionText);
    }

    return services;
  }

  /**
   * Fallback method to extract AWS services using hardcoded patterns
   */
  private extractAwsServicesFromPatterns(questionText: string): AwsServiceReference[] {
    const services: AwsServiceReference[] = [];
    const servicePatterns = [
      { pattern: /\b(ec2|elastic compute cloud)\b/i, name: 'Amazon EC2', code: 'ec2', category: 'compute' },
      { pattern: /\b(s3|simple storage service)\b/i, name: 'Amazon S3', code: 's3', category: 'storage' },
      { pattern: /\b(lambda|aws lambda)\b/i, name: 'AWS Lambda', code: 'lambda', category: 'compute' },
      { pattern: /\b(rds|relational database service)\b/i, name: 'Amazon RDS', code: 'rds', category: 'database' },
      { pattern: /\b(dynamodb|dynamo db)\b/i, name: 'Amazon DynamoDB', code: 'dynamodb', category: 'database' },
      { pattern: /\b(vpc|virtual private cloud)\b/i, name: 'Amazon VPC', code: 'vpc', category: 'networking' },
      { pattern: /\b(iam|identity and access management)\b/i, name: 'AWS IAM', code: 'iam', category: 'security' },
      { pattern: /\b(cloudformation|cloud formation)\b/i, name: 'AWS CloudFormation', code: 'cloudformation', category: 'developer-tools' },
      { pattern: /\b(cloudwatch|cloud watch)\b/i, name: 'Amazon CloudWatch', code: 'cloudwatch', category: 'monitoring' },
      { pattern: /\b(api gateway|apigateway)\b/i, name: 'Amazon API Gateway', code: 'apigateway', category: 'networking' }
    ];

    for (const { pattern, name, code, category } of servicePatterns) {
      const match = questionText.match(pattern);
      if (match) {
        services.push({
          serviceName: name,
          serviceCode: code,
          category,
          confidence: this.calculateServiceConfidence(match, questionText),
          context: this.extractContext(questionText, match.index || 0, match[0].length)
        });
      }
    }

    return services;
  }

  /**
   * Extract various entities from the question text
   */
  private extractEntities(questionText: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // AWS regions
    const regionPattern = /\b(us-east-1|us-west-2|eu-west-1|ap-southeast-1|ap-northeast-1|ca-central-1|eu-central-1|ap-south-1|sa-east-1)\b/gi;
    let match;
    while ((match = regionPattern.exec(questionText)) !== null) {
      entities.push({
        type: 'aws_region',
        value: match[0],
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        normalized: match[0].toLowerCase()
      });
    }

    // Instance types
    const instancePattern = /\b(t[2-4]\.(nano|micro|small|medium|large|xlarge|2xlarge)|m[4-6]\.(large|xlarge|2xlarge|4xlarge|8xlarge|12xlarge|16xlarge|24xlarge)|c[4-6]\.(large|xlarge|2xlarge|4xlarge|8xlarge|9xlarge|12xlarge|18xlarge|24xlarge))\b/gi;
    while ((match = instancePattern.exec(questionText)) !== null) {
      entities.push({
        type: 'instance_type',
        value: match[0],
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // Programming languages
    const languagePattern = /\b(python|javascript|java|node\.?js|typescript|go|rust|c#|php|ruby|scala|kotlin)\b/gi;
    while ((match = languagePattern.exec(questionText)) !== null) {
      entities.push({
        type: 'programming_language',
        value: match[0],
        confidence: 0.8,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // Error codes
    const errorPattern = /\b(4\d{2}|5\d{2}|AccessDenied|InvalidParameter|ResourceNotFound|ThrottlingException|ValidationException)\b/gi;
    while ((match = errorPattern.exec(questionText)) !== null) {
      entities.push({
        type: 'error_code',
        value: match[0],
        confidence: 0.85,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    return entities;
  }

  /**
   * Classify the type of question being asked
   */
  private classifyQuestionType(questionText: string): QuestionType {
    const questionLower = questionText.toLowerCase();

    // Technical questions
    if (/\b(api|cli|sdk|code|script|command|syntax|parameter|method|function)\b/.test(questionLower)) {
      return 'technical';
    }

    // Troubleshooting questions
    if (/\b(error|problem|issue|troubleshoot|debug|fix|not working|failed|exception|timeout)\b/.test(questionLower)) {
      return 'troubleshooting';
    }

    // How-to questions
    if (/\b(how to|how do i|how can i|step by step|tutorial|guide|setup|configure)\b/.test(questionLower)) {
      return 'howto';
    }

    // Comparison questions
    if (/\b(difference|compare|vs|versus|better|choose|which|alternative)\b/.test(questionLower)) {
      return 'comparison';
    }

    // Pricing questions
    if (/\b(cost|price|pricing|billing|charge|fee|expensive|cheap|budget)\b/.test(questionLower)) {
      return 'pricing';
    }

    // Security questions
    if (/\b(security|secure|permission|policy|role|encrypt|ssl|tls|certificate|compliance)\b/.test(questionLower)) {
      return 'security';
    }

    // Performance questions
    if (/\b(performance|optimize|speed|fast|slow|latency|throughput|scale|capacity)\b/.test(questionLower)) {
      return 'performance';
    }

    // Integration questions
    if (/\b(integrate|connect|link|combine|together|between|with)\b/.test(questionLower)) {
      return 'integration';
    }

    // Conceptual questions (default)
    return 'conceptual';
  }

  /**
   * Determine the user's intent behind the question
   */
  private determineIntent(questionText: string, questionType: QuestionType): QuestionIntent {
    const questionLower = questionText.toLowerCase();

    // Map question types to likely intents
    switch (questionType) {
      case 'troubleshooting':
        return 'troubleshoot';
      case 'howto':
        return 'implement';
      case 'comparison':
        return 'compare';
      case 'pricing':
        return 'cost';
      case 'security':
        return 'secure';
      case 'performance':
        return 'optimize';
      case 'integration':
        return 'implement';
    }

    // Check for specific intent keywords
    if (/\b(learn|understand|explain|what is|concept)\b/.test(questionLower)) {
      return 'learn';
    }

    if (/\b(migrate|migration|move|transfer)\b/.test(questionLower)) {
      return 'migrate';
    }

    if (/\b(monitor|monitoring|observe|track|alert)\b/.test(questionLower)) {
      return 'monitor';
    }

    if (/\b(optimize|improve|better|faster|efficient)\b/.test(questionLower)) {
      return 'optimize';
    }

    return 'learn'; // Default intent
  }

  /**
   * Assess the complexity of the question
   */
  private assessComplexity(
    questionText: string,
    awsServices: AwsServiceReference[],
    entities: ExtractedEntity[]
  ): QuestionComplexity {
    let complexityScore = 0;

    // Multiple AWS services increase complexity
    complexityScore += awsServices.length * 2;

    // Multiple entities increase complexity
    complexityScore += entities.length;

    // Question length
    if (questionText.length > 200) complexityScore += 3;
    else if (questionText.length > 100) complexityScore += 1;

    // Technical terms
    const technicalTerms = [
      'architecture', 'infrastructure', 'deployment', 'configuration',
      'integration', 'automation', 'orchestration', 'microservices',
      'serverless', 'containerization', 'kubernetes', 'docker'
    ];

    for (const term of technicalTerms) {
      if (questionText.toLowerCase().includes(term)) {
        complexityScore += 1;
      }
    }

    // Multiple questions or conditions
    const questionMarks = (questionText.match(/\?/g) || []).length;
    if (questionMarks > 1) complexityScore += 2;

    const conditions = (questionText.match(/\b(if|when|while|unless|provided|given)\b/gi) || []).length;
    complexityScore += conditions;

    if (complexityScore <= 3) return 'simple';
    if (complexityScore <= 8) return 'moderate';
    return 'complex';
  }

  /**
   * Calculate confidence score for the analysis
   */
  private calculateConfidence(
    questionType: QuestionType,
    awsServices: AwsServiceReference[],
    entities: ExtractedEntity[],
    questionText: string
  ): number {
    let confidence = 0.5; // Base confidence

    // AWS services boost confidence
    confidence += Math.min(awsServices.length * 0.15, 0.3);

    // High-confidence entities boost score
    const highConfidenceEntities = entities.filter(e => e.confidence > 0.8);
    confidence += Math.min(highConfidenceEntities.length * 0.1, 0.2);

    // Clear question structure
    if (questionText.includes('?')) confidence += 0.1;

    // Appropriate length
    if (questionText.length >= 20 && questionText.length <= 200) {
      confidence += 0.1;
    }

    // Penalize very short or very long questions
    if (questionText.length < 10) confidence -= 0.2;
    if (questionText.length > 500) confidence -= 0.1;

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Generate suggested actions based on analysis
   */
  private generateSuggestedActions(
    questionType: QuestionType,
    intent: QuestionIntent,
    awsServices: AwsServiceReference[]
  ): string[] {
    const actions: string[] = [];

    // Type-specific actions
    switch (questionType) {
      case 'troubleshooting':
        actions.push('Search AWS troubleshooting guides');
        actions.push('Check AWS service health dashboard');
        break;
      case 'howto':
        actions.push('Find step-by-step tutorials');
        actions.push('Look for AWS documentation');
        break;
      case 'comparison':
        actions.push('Compare AWS service features');
        actions.push('Review AWS service selection guides');
        break;
      case 'pricing':
        actions.push('Check AWS pricing calculator');
        actions.push('Review AWS cost optimization guides');
        break;
    }

    // Service-specific actions
    if (awsServices.length > 0) {
      const primaryService = awsServices[0];
      actions.push(`Search ${primaryService.serviceName} documentation`);
      actions.push(`Check ${primaryService.serviceName} best practices`);
    }

    return actions;
  }

  // Helper methods

  private async checkAwsRelevance(questionText: string): Promise<boolean> {
    const awsKeywords = [
      'aws', 'amazon', 'ec2', 's3', 'lambda', 'rds', 'dynamodb', 'vpc',
      'iam', 'cloudformation', 'cloudwatch', 'api gateway', 'elastic',
      'cloud', 'serverless', 'container', 'kubernetes', 'docker'
    ];

    const questionLower = questionText.toLowerCase();
    return awsKeywords.some(keyword => questionLower.includes(keyword));
  }

  private checkOffensiveContent(questionText: string): boolean {
    // Basic profanity filter - in production, use a proper service
    const offensiveWords = ['spam', 'abuse']; // Minimal list for demo
    const questionLower = questionText.toLowerCase();
    return offensiveWords.some(word => questionLower.includes(word));
  }

  private detectLanguage(questionText: string): string {
    // Simplified language detection - in production, use a proper service
    const englishPattern = /^[a-zA-Z0-9\s\.,\?!;:'"()\-_@#$%^&*+=<>\/\\[\]{}|`~]*$/;
    return englishPattern.test(questionText) ? 'en' : 'unknown';
  }

  private calculateServiceConfidence(match: RegExpMatchArray, questionText: string): number {
    let confidence = 0.7; // Base confidence

    // Exact match gets higher confidence
    if (match[0] === match[0].toUpperCase()) confidence += 0.1;

    // Context matters - if surrounded by relevant words
    const contextWords = ['aws', 'amazon', 'service', 'cloud', 'configure', 'setup'];
    const surroundingText = questionText.substring(
      Math.max(0, (match.index || 0) - 20),
      Math.min(questionText.length, (match.index || 0) + match[0].length + 20)
    ).toLowerCase();

    for (const word of contextWords) {
      if (surroundingText.includes(word)) {
        confidence += 0.05;
      }
    }

    return Math.min(confidence, 1);
  }

  private extractContext(text: string, startIndex: number, length: number): string {
    const contextStart = Math.max(0, startIndex - 30);
    const contextEnd = Math.min(text.length, startIndex + length + 30);
    return text.substring(contextStart, contextEnd).trim();
  }

  private async generateSuggestions(
    questionText: string,
    validation: QuestionValidation,
    analysis?: QuestionAnalysis
  ): Promise<QuestionSuggestion[]> {
    const suggestions: QuestionSuggestion[] = [];

    // Validation-based suggestions
    if (!validation.isAwsRelated) {
      suggestions.push({
        type: 'clarification',
        text: 'Try mentioning specific AWS services like EC2, S3, Lambda, or RDS',
        confidence: 0.8,
        reason: 'Question does not appear to be AWS-related'
      });
    }

    if (validation.warnings.some(w => w.code === 'UNSUPPORTED_LANGUAGE')) {
      suggestions.push({
        type: 'alternative',
        text: 'Please rephrase your question in English for better results',
        confidence: 0.9,
        reason: 'Language detection indicates non-English content'
      });
    }

    // Analysis-based suggestions
    if (analysis && analysis.confidence < this.config.confidenceThreshold) {
      suggestions.push({
        type: 'clarification',
        text: 'Could you provide more specific details about what you\'re trying to accomplish?',
        confidence: 0.7,
        reason: 'Low confidence in question analysis'
      });
    }

    return suggestions;
  }

  private createEmptyAnalysis(questionId: string): QuestionAnalysis {
    return {
      questionId,
      questionType: 'conceptual',
      awsServices: [],
      complexity: 'simple',
      intent: 'learn',
      entities: [],
      confidence: 0,
      suggestedActions: [],
      processingTime: 0
    };
  }

  private initializePatterns(): void {
    // Initialize patterns for better performance
    // This would be expanded in a full implementation
  }

  /**
   * Get processing statistics
   */
  public getStats(): any {
    return {
      config: this.config,
      patternsLoaded: {
        awsServices: this.awsServicePatterns.size,
        entities: this.entityPatterns.size,
        questionTypes: this.questionTypePatterns.size
      }
    };
  }
}

// Create singleton instance
export const questionEngine = new QuestionEngine({
  minQuestionLength: 5,
  maxQuestionLength: 1000,
  enableSpellCheck: true,
  enableProfanityFilter: true,
  confidenceThreshold: 0.6,
  supportedLanguages: ['en']
});

export default questionEngine;