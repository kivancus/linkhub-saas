import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { QuestionAnalysis } from '../types/question';
import { MCPSearchResult } from '../types/mcp';

/**
 * Answer Generation Service
 * 
 * Generates coherent, well-formatted answers from documentation search results
 * with proper structure, examples, and source attribution
 */

// Type definitions for answer generation
interface AnswerGenerationRequest {
  question: string;
  searchResults: SearchResultWithRanking[];
  questionAnalysis: QuestionAnalysis;
  sessionId: string;
  options?: AnswerGenerationOptions;
}

interface SearchResultWithRanking {
  result: MCPSearchResult & { enhanced?: boolean; relevanceScore?: number };
  relevanceScore: number;
  serviceMatch: boolean;
  titleMatch: boolean;
  contextMatch: boolean;
  qualityScore: number;
  finalScore: number;
}

interface AnswerGenerationOptions {
  maxLength?: number;
  includeCodeExamples?: boolean;
  includeStepByStep?: boolean;
  includeReferences?: boolean;
  format?: 'markdown' | 'html' | 'text';
  tone?: 'technical' | 'beginner' | 'comprehensive';
}

interface GeneratedAnswer {
  answerId: string;
  question: string;
  answer: string;
  format: string;
  sources: AnswerSource[];
  metadata: AnswerMetadata;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

interface AnswerSource {
  url: string;
  title: string;
  relevanceScore: number;
  usedInAnswer: boolean;
  section?: string;
}

interface AnswerMetadata {
  answerType: 'howto' | 'conceptual' | 'troubleshooting' | 'comparison' | 'reference';
  wordCount: number;
  sourceCount: number;
  hasCodeExamples: boolean;
  hasStepByStep: boolean;
  qualityScore: number;
  completenessScore: number;
}

interface AnswerTemplate {
  type: string;
  structure: string[];
  requiredSections: string[];
  optionalSections: string[];
}

class AnswerGeneratorService {
  private readonly templates: Map<string, AnswerTemplate> = new Map();
  private readonly MAX_ANSWER_LENGTH = 4000;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.3;

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate a comprehensive answer from search results
   */
  public async generateAnswer(request: AnswerGenerationRequest): Promise<GeneratedAnswer> {
    const startTime = Date.now();
    const answerId = this.generateAnswerId(request);

    try {
      logger.info('Starting answer generation', {
        answerId,
        question: request.question.substring(0, 100),
        resultCount: request.searchResults.length,
        questionType: request.questionAnalysis.questionType
      });

      // Validate inputs
      if (!request.searchResults || request.searchResults.length === 0) {
        throw new Error('No search results provided for answer generation');
      }

      // Determine answer type and template
      const answerType = this.determineAnswerType(request.questionAnalysis);
      const template = this.getTemplate(answerType);

      // Filter and rank sources
      const qualifiedSources = this.filterQualifiedSources(request.searchResults);
      if (qualifiedSources.length === 0) {
        throw new Error('No qualified sources found for answer generation');
      }

      // Extract and synthesize content
      const synthesizedContent = await this.synthesizeContent(
        request.question,
        qualifiedSources,
        request.questionAnalysis
      );

      // Generate structured answer using template
      const structuredAnswer = this.generateStructuredAnswer(
        synthesizedContent,
        template,
        request.options || {}
      );

      // Add source references
      const answerWithSources = this.addSourceReferences(
        structuredAnswer,
        qualifiedSources,
        request.options?.includeReferences !== false
      );

      // Calculate confidence and quality scores
      const confidence = this.calculateAnswerConfidence(
        qualifiedSources,
        synthesizedContent,
        request.questionAnalysis
      );

      const metadata = this.generateAnswerMetadata(
        answerWithSources,
        qualifiedSources,
        answerType
      );

      // Create answer sources
      const sources = qualifiedSources.map(source => ({
        url: source.result.url,
        title: source.result.title,
        relevanceScore: source.finalScore,
        usedInAnswer: true,
        section: this.extractRelevantSection(source.result.context)
      }));

      const processingTime = Date.now() - startTime;

      logger.info('Answer generation completed successfully', {
        answerId,
        confidence,
        wordCount: metadata.wordCount,
        sourceCount: sources.length,
        processingTime
      });

      return {
        answerId,
        question: request.question,
        answer: answerWithSources,
        format: request.options?.format || 'markdown',
        sources,
        metadata,
        confidence,
        processingTime,
        success: true
      };

    } catch (error) {
      logger.error('Answer generation failed', {
        answerId,
        error: getErrorMessage(error),
        question: request.question.substring(0, 100)
      });

      return {
        answerId,
        question: request.question,
        answer: '',
        format: 'markdown',
        sources: [],
        metadata: this.createEmptyMetadata(),
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * Generate a quick answer for simple questions
   */
  public async generateQuickAnswer(
    question: string,
    topResult: SearchResultWithRanking
  ): Promise<string> {
    try {
      const context = topResult.result.context;
      const title = topResult.result.title;
      
      // Create a concise answer based on the top result
      let answer = `Based on the AWS documentation:\n\n`;
      answer += `**${title}**\n\n`;
      answer += `${context}\n\n`;
      answer += `For more details, see: [${title}](${topResult.result.url})`;

      return answer;
    } catch (error) {
      logger.error('Quick answer generation failed', {
        error: getErrorMessage(error),
        question: question.substring(0, 100)
      });
      return 'I apologize, but I was unable to generate an answer for your question. Please try rephrasing or asking a more specific question.';
    }
  }

  // Private helper methods

  private initializeTemplates(): void {
    // How-to template
    this.templates.set('howto', {
      type: 'howto',
      structure: ['overview', 'prerequisites', 'steps', 'examples', 'references'],
      requiredSections: ['overview', 'steps'],
      optionalSections: ['prerequisites', 'examples', 'references']
    });

    // Conceptual template
    this.templates.set('conceptual', {
      type: 'conceptual',
      structure: ['definition', 'explanation', 'use_cases', 'examples', 'references'],
      requiredSections: ['definition', 'explanation'],
      optionalSections: ['use_cases', 'examples', 'references']
    });

    // Troubleshooting template
    this.templates.set('troubleshooting', {
      type: 'troubleshooting',
      structure: ['problem_description', 'common_causes', 'solutions', 'prevention', 'references'],
      requiredSections: ['problem_description', 'solutions'],
      optionalSections: ['common_causes', 'prevention', 'references']
    });

    // Comparison template
    this.templates.set('comparison', {
      type: 'comparison',
      structure: ['overview', 'comparison_table', 'use_cases', 'recommendations', 'references'],
      requiredSections: ['overview', 'comparison_table'],
      optionalSections: ['use_cases', 'recommendations', 'references']
    });

    // Reference template
    this.templates.set('reference', {
      type: 'reference',
      structure: ['summary', 'parameters', 'examples', 'related', 'references'],
      requiredSections: ['summary'],
      optionalSections: ['parameters', 'examples', 'related', 'references']
    });
  }

  private determineAnswerType(analysis: QuestionAnalysis): string {
    switch (analysis.questionType) {
      case 'howto':
        return 'howto';
      case 'troubleshooting':
        return 'troubleshooting';
      case 'comparison':
        return 'comparison';
      case 'technical':
        return 'reference';
      case 'conceptual':
      default:
        return 'conceptual';
    }
  }

  private getTemplate(answerType: string): AnswerTemplate {
    return this.templates.get(answerType) || this.templates.get('conceptual')!;
  }

  private filterQualifiedSources(results: SearchResultWithRanking[]): SearchResultWithRanking[] {
    return results
      .filter(result => result.finalScore >= this.MIN_CONFIDENCE_THRESHOLD)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 5); // Use top 5 sources
  }

  private async synthesizeContent(
    question: string,
    sources: SearchResultWithRanking[],
    analysis: QuestionAnalysis
  ): Promise<Map<string, string>> {
    const content = new Map<string, string>();

    // Extract key information from sources
    const contexts = sources.map(s => s.result.context).join(' ');
    const titles = sources.map(s => s.result.title);

    // Generate overview/definition
    content.set('overview', this.generateOverview(question, contexts, analysis));

    // Generate explanation based on question type
    if (analysis.questionType === 'howto') {
      content.set('steps', this.generateSteps(contexts, analysis));
    } else if (analysis.questionType === 'troubleshooting') {
      content.set('solutions', this.generateSolutions(contexts, analysis));
    } else {
      content.set('explanation', this.generateExplanation(contexts, analysis));
    }

    // Generate examples if applicable
    if (this.shouldIncludeExamples(analysis)) {
      content.set('examples', this.generateExamples(contexts, analysis));
    }

    return content;
  }

  private generateOverview(question: string, contexts: string, analysis: QuestionAnalysis): string {
    const awsServices = analysis.awsServices.map((s: any) => s.serviceName).join(', ');
    
    let overview = `## Overview\n\n`;
    
    if (analysis.questionType === 'howto') {
      const action = question.toLowerCase().replace(/^how (to|do i|can i) /, '').replace(/\?$/, '');
      overview += `This comprehensive guide explains how to ${action}. `;
    } else if (analysis.questionType === 'troubleshooting') {
      overview += `This troubleshooting guide addresses issues related to ${awsServices || 'AWS services'}. `;
    } else {
      overview += `This section provides detailed information about ${awsServices || 'AWS services'}. `;
    }

    // Add context from top sources with more detail
    const keyInfo = this.extractKeyInformation(contexts);
    if (keyInfo) {
      overview += `\n\n${keyInfo}`;
      
      // Add additional context if available
      const sentences = contexts.split(/[.!?]+/).filter(s => s.trim().length > 50);
      if (sentences.length > 1) {
        overview += ` ${sentences[1].trim()}.`;
      }
    }

    return overview;
  }

  private generateSteps(contexts: string, analysis: QuestionAnalysis): string {
    let steps = `## Step-by-Step Instructions\n\n`;
    
    // Extract step-like information from contexts
    const stepKeywords = ['step', 'first', 'then', 'next', 'finally', 'create', 'configure', 'set up', 'open', 'choose', 'select', 'enter'];
    const sentences = contexts.split(/[.!?]+/).filter(s => s.trim().length > 15);
    
    const stepSentences = sentences.filter(sentence => 
      stepKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    );

    if (stepSentences.length > 0) {
      // Use extracted steps from context
      stepSentences.slice(0, 8).forEach((step, index) => {
        const cleanStep = step.trim().replace(/^\d+[\.\)]\s*/, ''); // Remove existing numbering
        steps += `**Step ${index + 1}**: ${cleanStep}\n\n`;
      });
    } else {
      // Generate detailed steps based on AWS services
      const services = analysis.awsServices.map((s: any) => s.serviceName);
      if (services.length > 0) {
        const service = services[0];
        
        if (service.toLowerCase().includes('lambda')) {
          steps += `**Step 1**: Open the AWS Lambda console in your preferred region\n\n`;
          steps += `**Step 2**: Choose "Create function" and select "Author from scratch"\n\n`;
          steps += `**Step 3**: Enter a function name and choose a runtime (Python, Node.js, etc.)\n\n`;
          steps += `**Step 4**: Configure the execution role with appropriate permissions\n\n`;
          steps += `**Step 5**: Write or upload your function code\n\n`;
          steps += `**Step 6**: Configure triggers and environment variables as needed\n\n`;
          steps += `**Step 7**: Test your function and deploy to production\n\n`;
        } else if (service.toLowerCase().includes('s3')) {
          steps += `**Step 1**: Open the Amazon S3 console\n\n`;
          steps += `**Step 2**: Choose "Create bucket" and enter a unique bucket name\n\n`;
          steps += `**Step 3**: Select the AWS Region for your bucket\n\n`;
          steps += `**Step 4**: Configure bucket settings (versioning, encryption, etc.)\n\n`;
          steps += `**Step 5**: Set bucket permissions and access policies\n\n`;
          steps += `**Step 6**: Review settings and create the bucket\n\n`;
          steps += `**Step 7**: Upload objects and configure additional features as needed\n\n`;
        } else if (service.toLowerCase().includes('vpc')) {
          steps += `**Step 1**: Open the Amazon VPC console\n\n`;
          steps += `**Step 2**: Choose "Create VPC" and configure the IP address range\n\n`;
          steps += `**Step 3**: Create subnets in different Availability Zones\n\n`;
          steps += `**Step 4**: Configure route tables and internet gateway\n\n`;
          steps += `**Step 5**: Set up security groups and network ACLs\n\n`;
          steps += `**Step 6**: Test connectivity and configure additional features\n\n`;
        } else {
          steps += `**Step 1**: Access the ${service} console in the AWS Management Console\n\n`;
          steps += `**Step 2**: Configure the basic settings and parameters\n\n`;
          steps += `**Step 3**: Set up security and access controls\n\n`;
          steps += `**Step 4**: Review configuration and deploy\n\n`;
          steps += `**Step 5**: Test functionality and monitor performance\n\n`;
        }
      }
    }

    return steps;
  }

  private generateSolutions(contexts: string, analysis: QuestionAnalysis): string {
    let solutions = `## Troubleshooting Solutions\n\n`;
    
    // Extract solution-oriented information
    const solutionKeywords = ['solution', 'fix', 'resolve', 'check', 'verify', 'ensure', 'update', 'increase', 'optimize', 'configure'];
    const sentences = contexts.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    const solutionSentences = sentences.filter(sentence => 
      solutionKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
    );

    if (solutionSentences.length > 0) {
      solutionSentences.slice(0, 5).forEach((solution, index) => {
        solutions += `### Solution ${index + 1}\n\n${solution.trim()}.\n\n`;
      });
    } else {
      // Generate service-specific solutions
      const services = analysis.awsServices.map((s: any) => s.serviceName);
      if (services.length > 0) {
        const service = services[0].toLowerCase();
        
        if (service.includes('lambda')) {
          solutions += `### Common Lambda Issues and Solutions\n\n`;
          solutions += `**Timeout Errors**: Increase the timeout setting in your function configuration (maximum 15 minutes) or optimize your code to run faster.\n\n`;
          solutions += `**Memory Errors**: Increase the memory allocation, which also increases CPU power proportionally.\n\n`;
          solutions += `**Permission Errors**: Verify that your Lambda execution role has the necessary permissions for the resources it needs to access.\n\n`;
          solutions += `**Cold Start Issues**: Keep your deployment package small and consider using provisioned concurrency for consistent performance.\n\n`;
        } else if (service.includes('dynamodb')) {
          solutions += `### DynamoDB Performance Solutions\n\n`;
          solutions += `**Throttling Issues**: Monitor CloudWatch metrics and enable auto-scaling or increase provisioned capacity.\n\n`;
          solutions += `**Hot Partition Problems**: Use composite partition keys to distribute requests more evenly across partitions.\n\n`;
          solutions += `**High Latency**: Consider using DynamoDB Accelerator (DAX) for microsecond-latency caching.\n\n`;
          solutions += `**Query Performance**: Optimize your queries and consider using Global Secondary Indexes (GSI) for different access patterns.\n\n`;
        } else {
          solutions += `### General AWS Service Troubleshooting\n\n`;
          solutions += `**Access Issues**: Check your AWS credentials and IAM permissions\n\n`;
          solutions += `**Configuration Problems**: Verify the service configuration matches your requirements\n\n`;
          solutions += `**Performance Issues**: Monitor CloudWatch metrics and optimize based on usage patterns\n\n`;
          solutions += `**Network Connectivity**: Check security groups, NACLs, and routing configurations\n\n`;
        }
      }
    }

    return solutions;
  }

  private generateExplanation(contexts: string, analysis: QuestionAnalysis): string {
    let explanation = `## Detailed Explanation\n\n`;
    
    // Use the most relevant context information with better formatting
    const sentences = contexts.split(/[.!?]+/).filter(s => s.trim().length > 30);
    const topSentences = sentences.slice(0, 5); // Use more sentences for detail
    
    if (topSentences.length > 0) {
      topSentences.forEach((sentence, index) => {
        const cleanSentence = sentence.trim();
        if (index === 0) {
          explanation += `${cleanSentence}.\n\n`;
        } else {
          explanation += `${cleanSentence}.\n\n`;
        }
      });
    }

    // Add service-specific additional information
    const services = analysis.awsServices.map((s: any) => s.serviceName);
    if (services.length > 0) {
      const service = services[0].toLowerCase();
      
      if (service.includes('lambda') && service.includes('ec2')) {
        explanation += `### Key Differences\n\n`;
        explanation += `**Management**: EC2 requires you to manage the operating system, security patches, and scaling, while Lambda is fully managed by AWS.\n\n`;
        explanation += `**Pricing**: EC2 charges for running time regardless of usage, while Lambda charges only for actual execution time and requests.\n\n`;
        explanation += `**Scaling**: EC2 requires manual scaling or auto-scaling groups, while Lambda scales automatically based on incoming requests.\n\n`;
        explanation += `**Use Cases**: EC2 is ideal for long-running applications and when you need full control, while Lambda is perfect for event-driven, short-duration tasks.\n\n`;
      }
    }

    return explanation;
  }

  private generateExamples(contexts: string, analysis: QuestionAnalysis): string {
    let examples = `## Examples and Code Samples\n\n`;
    
    // Look for code-like patterns or specific examples in contexts
    const codePatterns = /`[^`]+`|```[\s\S]*?```/g;
    const codeMatches = contexts.match(codePatterns);
    
    if (codeMatches && codeMatches.length > 0) {
      examples += `### Code Example from Documentation\n\n`;
      examples += `${codeMatches[0]}\n\n`;
    }

    // Generate service-specific examples
    const services = analysis.awsServices.map((s: any) => s.serviceName);
    if (services.length > 0) {
      const service = services[0].toLowerCase();
      
      if (service.includes('s3')) {
        examples += `### AWS CLI Example: Create S3 Bucket with Versioning\n\n`;
        examples += '```bash\n# Create the bucket\naws s3 mb s3://my-unique-bucket-name\n\n# Enable versioning\naws s3api put-bucket-versioning \\\n  --bucket my-unique-bucket-name \\\n  --versioning-configuration Status=Enabled\n\n# Verify versioning is enabled\naws s3api get-bucket-versioning --bucket my-unique-bucket-name\n```\n\n';
        
        examples += `### Python SDK Example\n\n`;
        examples += '```python\nimport boto3\n\n# Create S3 client\ns3_client = boto3.client(\'s3\')\n\n# Create bucket with versioning\nbucket_name = \'my-unique-bucket-name\'\ns3_client.create_bucket(Bucket=bucket_name)\n\n# Enable versioning\ns3_client.put_bucket_versioning(\n    Bucket=bucket_name,\n    VersioningConfiguration={\'Status\': \'Enabled\'}\n)\n\nprint(f"Bucket {bucket_name} created with versioning enabled")\n```\n\n';
      } else if (service.includes('lambda')) {
        examples += `### Python Lambda Function Example\n\n`;
        examples += '```python\nimport json\nimport logging\n\n# Set up logging\nlogger = logging.getLogger()\nlogger.setLevel(logging.INFO)\n\ndef lambda_handler(event, context):\n    """\n    AWS Lambda function handler\n    """\n    try:\n        # Log the incoming event\n        logger.info(f"Received event: {json.dumps(event)}")\n        \n        # Process the event\n        result = process_event(event)\n        \n        # Return success response\n        return {\n            \'statusCode\': 200,\n            \'body\': json.dumps({\n                \'message\': \'Function executed successfully\',\n                \'result\': result\n            })\n        }\n    except Exception as e:\n        logger.error(f"Error processing event: {str(e)}")\n        return {\n            \'statusCode\': 500,\n            \'body\': json.dumps({\n                \'error\': \'Internal server error\'\n            })\n        }\n\ndef process_event(event):\n    # Your business logic here\n    return {"processed": True}\n```\n\n';
      } else if (service.includes('dynamodb')) {
        examples += `### DynamoDB Performance Optimization Example\n\n`;
        examples += '```python\nimport boto3\nfrom boto3.dynamodb.conditions import Key\n\n# Create DynamoDB resource\ndynamodb = boto3.resource(\'dynamodb\')\ntable = dynamodb.Table(\'my-table\')\n\n# Efficient query using partition key and sort key\nresponse = table.query(\n    KeyConditionExpression=Key(\'partition_key\').eq(\'user123\') & \n                          Key(\'sort_key\').begins_with(\'2024-\')\n)\n\n# Use pagination for large result sets\nresponse = table.scan(\n    FilterExpression=Key(\'status\').eq(\'active\'),\n    Limit=100\n)\n\n# Process results\nfor item in response[\'Items\']:\n    print(f"Processing item: {item}")\n```\n\n';
      } else if (service.includes('vpc')) {
        examples += `### VPC Peering Setup Example\n\n`;
        examples += '```bash\n# Create VPC peering connection\naws ec2 create-vpc-peering-connection \\\n  --vpc-id vpc-12345678 \\\n  --peer-vpc-id vpc-87654321 \\\n  --peer-region us-west-2\n\n# Accept the peering connection\naws ec2 accept-vpc-peering-connection \\\n  --vpc-peering-connection-id pcx-1234567890abcdef0\n\n# Add route to route table\naws ec2 create-route \\\n  --route-table-id rtb-12345678 \\\n  --destination-cidr-block 10.1.0.0/16 \\\n  --vpc-peering-connection-id pcx-1234567890abcdef0\n```\n\n';
      }
    }

    return examples;
  }

  private shouldIncludeExamples(analysis: QuestionAnalysis): boolean {
    return analysis.questionType === 'howto' || 
           analysis.questionType === 'technical' ||
           analysis.complexity !== 'simple';
  }

  private generateStructuredAnswer(
    content: Map<string, string>,
    template: AnswerTemplate,
    options: AnswerGenerationOptions
  ): string {
    let answer = '';

    // Build answer according to template structure
    for (const section of template.structure) {
      if (content.has(section)) {
        answer += content.get(section) + '\n\n';
      } else if (template.requiredSections.includes(section)) {
        // Add placeholder for required sections
        answer += `## ${this.formatSectionTitle(section)}\n\n`;
        answer += `Information about ${section.replace('_', ' ')} will be provided based on AWS documentation.\n\n`;
      }
    }

    // Trim excessive length
    if (answer.length > this.MAX_ANSWER_LENGTH) {
      answer = answer.substring(0, this.MAX_ANSWER_LENGTH) + '...\n\n*Answer truncated for length. Please refer to the official AWS documentation links below for complete information.*\n\n';
    }

    return answer.trim();
  }

  private addSourceReferences(
    answer: string,
    sources: SearchResultWithRanking[],
    includeReferences: boolean
  ): string {
    if (!includeReferences || sources.length === 0) {
      return answer;
    }

    let answerWithRefs = answer + '\n\n## References\n\n';
    
    sources.forEach((source, index) => {
      answerWithRefs += `${index + 1}. [${source.result.title}](${source.result.url})\n`;
    });

    return answerWithRefs;
  }

  private calculateAnswerConfidence(
    sources: SearchResultWithRanking[],
    content: Map<string, string>,
    analysis: QuestionAnalysis
  ): number {
    let confidence = 0.5; // Base confidence

    // Source quality contributes to confidence
    const avgSourceScore = sources.reduce((sum, s) => sum + s.finalScore, 0) / sources.length;
    confidence += avgSourceScore * 0.3;

    // Content completeness
    const contentSections = content.size;
    confidence += Math.min(contentSections * 0.1, 0.2);

    // Question analysis confidence
    confidence += analysis.confidence * 0.2;

    return Math.min(Math.max(confidence, 0), 1);
  }

  private generateAnswerMetadata(
    answer: string,
    sources: SearchResultWithRanking[],
    answerType: string
  ): AnswerMetadata {
    const wordCount = answer.split(/\s+/).length;
    const hasCodeExamples = /```[\s\S]*?```|`[^`]+`/.test(answer);
    const hasStepByStep = /^\d+\./m.test(answer);

    return {
      answerType: answerType as any,
      wordCount,
      sourceCount: sources.length,
      hasCodeExamples,
      hasStepByStep,
      qualityScore: this.calculateQualityScore(answer, sources),
      completenessScore: this.calculateCompletenessScore(answer)
    };
  }

  private calculateQualityScore(answer: string, sources: SearchResultWithRanking[]): number {
    let score = 0.5;

    // Length appropriateness
    if (answer.length >= 200 && answer.length <= 1500) score += 0.2;

    // Structure indicators
    if (answer.includes('##')) score += 0.1; // Has headers
    if (answer.includes('```')) score += 0.1; // Has code examples
    if (/^\d+\./m.test(answer)) score += 0.1; // Has numbered lists

    // Source quality
    const avgSourceScore = sources.reduce((sum, s) => sum + s.finalScore, 0) / sources.length;
    score += avgSourceScore * 0.1;

    return Math.min(score, 1);
  }

  private calculateCompletenessScore(answer: string): number {
    let score = 0.3;

    // Check for key sections
    if (answer.includes('## Overview') || answer.includes('## Explanation')) score += 0.2;
    if (answer.includes('## Steps') || answer.includes('## Solutions')) score += 0.2;
    if (answer.includes('## Examples')) score += 0.1;
    if (answer.includes('## References')) score += 0.1;
    if (answer.length > 300) score += 0.1;

    return Math.min(score, 1);
  }

  private extractKeyInformation(contexts: string): string {
    // Extract the most informative sentence
    const sentences = contexts.split(/[.!?]+/).filter(s => s.trim().length > 30);
    return sentences.length > 0 ? sentences[0].trim() + '.' : '';
  }

  private extractRelevantSection(context: string): string {
    // Extract a relevant section identifier from context
    const words = context.split(' ').slice(0, 5).join(' ');
    return words.length > 0 ? words + '...' : 'General Information';
  }

  private formatSectionTitle(section: string): string {
    return section.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private generateAnswerId(request: AnswerGenerationRequest): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(request.question + request.sessionId + Date.now())
      .digest('hex');
    return `answer_${hash.substring(0, 8)}`;
  }

  private createEmptyMetadata(): AnswerMetadata {
    return {
      answerType: 'conceptual',
      wordCount: 0,
      sourceCount: 0,
      hasCodeExamples: false,
      hasStepByStep: false,
      qualityScore: 0,
      completenessScore: 0
    };
  }

  /**
   * Get service statistics
   */
  public getStats() {
    return {
      templates: Array.from(this.templates.keys()),
      maxAnswerLength: this.MAX_ANSWER_LENGTH,
      minConfidenceThreshold: this.MIN_CONFIDENCE_THRESHOLD,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
export const answerGeneratorService = new AnswerGeneratorService();
export default answerGeneratorService;