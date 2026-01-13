/**
 * Question processing and analysis type definitions
 */

export interface Question {
  id: string;
  sessionId: string;
  originalText: string;
  normalizedText: string;
  language: string;
  timestamp: Date;
  metadata: QuestionMetadata;
}

export interface QuestionMetadata {
  userAgent?: string;
  ipAddress?: string;
  source?: 'web' | 'api' | 'mobile' | 'test';
  context?: string;
}

export interface QuestionAnalysis {
  questionId: string;
  questionType: QuestionType;
  awsServices: AwsServiceReference[];
  complexity: QuestionComplexity;
  intent: QuestionIntent;
  entities: ExtractedEntity[];
  confidence: number;
  suggestedActions: string[];
  processingTime: number;
}

export type QuestionType = 
  | 'technical'      // API, CLI, SDK, code-related
  | 'conceptual'     // What is, explain, differences
  | 'troubleshooting' // Errors, problems, debugging
  | 'howto'          // Step-by-step instructions
  | 'comparison'     // Compare services or features
  | 'pricing'        // Cost-related questions
  | 'security'       // Security and compliance
  | 'performance'    // Optimization and performance
  | 'integration';   // Service integration questions

export type QuestionComplexity = 'simple' | 'moderate' | 'complex';

export type QuestionIntent = 
  | 'learn'          // Learning about AWS concepts
  | 'implement'      // Implementing a solution
  | 'troubleshoot'   // Solving a problem
  | 'compare'        // Comparing options
  | 'optimize'       // Improving existing setup
  | 'migrate'        // Migration scenarios
  | 'secure'         // Security implementation
  | 'cost'           // Cost optimization
  | 'monitor';       // Monitoring and observability

export interface AwsServiceReference {
  serviceName: string;
  serviceCode: string;
  category: string;
  confidence: number;
  context: string; // Where in the question it was mentioned
}

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  normalized?: string;
}

export type EntityType = 
  | 'aws_service'
  | 'aws_region'
  | 'instance_type'
  | 'programming_language'
  | 'framework'
  | 'error_code'
  | 'cli_command'
  | 'api_method'
  | 'resource_name'
  | 'configuration_parameter'
  | 'time_duration'
  | 'data_size'
  | 'number'
  | 'url'
  | 'file_extension';

export interface QuestionValidation {
  isValid: boolean;
  isAwsRelated: boolean;
  hasMinimumLength: boolean;
  hasMaximumLength: boolean;
  containsOffensiveContent: boolean;
  language: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

export interface QuestionNormalization {
  original: string;
  normalized: string;
  changes: NormalizationChange[];
}

export interface NormalizationChange {
  type: 'spelling' | 'abbreviation' | 'case' | 'punctuation' | 'whitespace';
  original: string;
  normalized: string;
  position: number;
}

export interface QuestionSuggestion {
  type: 'clarification' | 'alternative' | 'related' | 'completion';
  text: string;
  confidence: number;
  reason: string;
}

export interface QuestionProcessingResult {
  question: Question;
  analysis: QuestionAnalysis;
  validation: QuestionValidation;
  normalization: QuestionNormalization;
  suggestions: QuestionSuggestion[];
  processingTime: number;
  success: boolean;
  error?: string;
}

// Configuration interfaces
export interface QuestionEngineConfig {
  minQuestionLength: number;
  maxQuestionLength: number;
  enableSpellCheck: boolean;
  enableProfanityFilter: boolean;
  confidenceThreshold: number;
  supportedLanguages: string[];
  awsServiceDatabase: string;
}

// Statistics and analytics
export interface QuestionStats {
  totalQuestions: number;
  questionsByType: Record<QuestionType, number>;
  questionsByComplexity: Record<QuestionComplexity, number>;
  questionsByIntent: Record<QuestionIntent, number>;
  averageProcessingTime: number;
  topAwsServices: Array<{ service: string; count: number }>;
  commonPatterns: Array<{ pattern: string; frequency: number }>;
}