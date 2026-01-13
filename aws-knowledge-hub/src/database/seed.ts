import { databaseManager } from './connection';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

/**
 * Seed data for development and testing
 */

const AWS_SERVICES_SEED = [
  // Compute Services
  { service_name: 'Amazon EC2', service_code: 'ec2', category: 'compute', description: 'Virtual servers in the cloud', documentation_url: 'https://docs.aws.amazon.com/ec2/' },
  { service_name: 'AWS Lambda', service_code: 'lambda', category: 'compute', description: 'Run code without thinking about servers', documentation_url: 'https://docs.aws.amazon.com/lambda/' },
  { service_name: 'Amazon ECS', service_code: 'ecs', category: 'compute', description: 'Run containerized applications', documentation_url: 'https://docs.aws.amazon.com/ecs/' },
  { service_name: 'Amazon EKS', service_code: 'eks', category: 'compute', description: 'Managed Kubernetes service', documentation_url: 'https://docs.aws.amazon.com/eks/' },
  { service_name: 'AWS Fargate', service_code: 'fargate', category: 'compute', description: 'Serverless compute for containers', documentation_url: 'https://docs.aws.amazon.com/fargate/' },

  // Storage Services
  { service_name: 'Amazon S3', service_code: 's3', category: 'storage', description: 'Object storage service', documentation_url: 'https://docs.aws.amazon.com/s3/' },
  { service_name: 'Amazon EBS', service_code: 'ebs', category: 'storage', description: 'Block storage for EC2', documentation_url: 'https://docs.aws.amazon.com/ebs/' },
  { service_name: 'Amazon EFS', service_code: 'efs', category: 'storage', description: 'Managed file system', documentation_url: 'https://docs.aws.amazon.com/efs/' },
  { service_name: 'AWS Storage Gateway', service_code: 'storagegateway', category: 'storage', description: 'Hybrid cloud storage', documentation_url: 'https://docs.aws.amazon.com/storagegateway/' },

  // Database Services
  { service_name: 'Amazon RDS', service_code: 'rds', category: 'database', description: 'Managed relational database', documentation_url: 'https://docs.aws.amazon.com/rds/' },
  { service_name: 'Amazon DynamoDB', service_code: 'dynamodb', category: 'database', description: 'NoSQL database service', documentation_url: 'https://docs.aws.amazon.com/dynamodb/' },
  { service_name: 'Amazon Aurora', service_code: 'aurora', category: 'database', description: 'MySQL and PostgreSQL compatible database', documentation_url: 'https://docs.aws.amazon.com/aurora/' },
  { service_name: 'Amazon ElastiCache', service_code: 'elasticache', category: 'database', description: 'In-memory caching service', documentation_url: 'https://docs.aws.amazon.com/elasticache/' },
  { service_name: 'Amazon DocumentDB', service_code: 'documentdb', category: 'database', description: 'MongoDB compatible database', documentation_url: 'https://docs.aws.amazon.com/documentdb/' },

  // Networking Services
  { service_name: 'Amazon VPC', service_code: 'vpc', category: 'networking', description: 'Virtual private cloud', documentation_url: 'https://docs.aws.amazon.com/vpc/' },
  { service_name: 'Amazon CloudFront', service_code: 'cloudfront', category: 'networking', description: 'Content delivery network', documentation_url: 'https://docs.aws.amazon.com/cloudfront/' },
  { service_name: 'Elastic Load Balancing', service_code: 'elb', category: 'networking', description: 'Distribute incoming traffic', documentation_url: 'https://docs.aws.amazon.com/elasticloadbalancing/' },
  { service_name: 'Amazon Route 53', service_code: 'route53', category: 'networking', description: 'DNS web service', documentation_url: 'https://docs.aws.amazon.com/route53/' },
  { service_name: 'AWS Direct Connect', service_code: 'directconnect', category: 'networking', description: 'Dedicated network connection', documentation_url: 'https://docs.aws.amazon.com/directconnect/' },

  // Security Services
  { service_name: 'AWS IAM', service_code: 'iam', category: 'security', description: 'Identity and access management', documentation_url: 'https://docs.aws.amazon.com/iam/' },
  { service_name: 'AWS KMS', service_code: 'kms', category: 'security', description: 'Key management service', documentation_url: 'https://docs.aws.amazon.com/kms/' },
  { service_name: 'AWS Secrets Manager', service_code: 'secretsmanager', category: 'security', description: 'Manage secrets', documentation_url: 'https://docs.aws.amazon.com/secretsmanager/' },
  { service_name: 'AWS Certificate Manager', service_code: 'acm', category: 'security', description: 'SSL/TLS certificates', documentation_url: 'https://docs.aws.amazon.com/acm/' },

  // Developer Tools
  { service_name: 'AWS CloudFormation', service_code: 'cloudformation', category: 'developer-tools', description: 'Infrastructure as code', documentation_url: 'https://docs.aws.amazon.com/cloudformation/' },
  { service_name: 'AWS CDK', service_code: 'cdk', category: 'developer-tools', description: 'Cloud development kit', documentation_url: 'https://docs.aws.amazon.com/cdk/' },
  { service_name: 'AWS CodePipeline', service_code: 'codepipeline', category: 'developer-tools', description: 'Continuous delivery service', documentation_url: 'https://docs.aws.amazon.com/codepipeline/' },
  { service_name: 'AWS CodeBuild', service_code: 'codebuild', category: 'developer-tools', description: 'Build and test code', documentation_url: 'https://docs.aws.amazon.com/codebuild/' },

  // Monitoring Services
  { service_name: 'Amazon CloudWatch', service_code: 'cloudwatch', category: 'monitoring', description: 'Monitoring and observability', documentation_url: 'https://docs.aws.amazon.com/cloudwatch/' },
  { service_name: 'AWS X-Ray', service_code: 'xray', category: 'monitoring', description: 'Application tracing', documentation_url: 'https://docs.aws.amazon.com/xray/' },
  { service_name: 'AWS CloudTrail', service_code: 'cloudtrail', category: 'monitoring', description: 'API logging and monitoring', documentation_url: 'https://docs.aws.amazon.com/cloudtrail/' },
];

const QUESTION_SUGGESTIONS_SEED = [
  // General AWS Questions
  { suggestion_text: 'How do I create an EC2 instance?', category: 'general', aws_service: 'ec2' },
  { suggestion_text: 'What is the difference between S3 and EBS?', category: 'general', aws_service: 's3' },
  { suggestion_text: 'How do I set up a VPC?', category: 'general', aws_service: 'vpc' },
  { suggestion_text: 'What are the Lambda pricing models?', category: 'general', aws_service: 'lambda' },
  { suggestion_text: 'How do I configure IAM roles?', category: 'general', aws_service: 'iam' },

  // Troubleshooting Questions
  { suggestion_text: 'Why is my EC2 instance not starting?', category: 'troubleshooting', aws_service: 'ec2' },
  { suggestion_text: 'How to fix S3 access denied errors?', category: 'troubleshooting', aws_service: 's3' },
  { suggestion_text: 'Lambda function timeout issues', category: 'troubleshooting', aws_service: 'lambda' },
  { suggestion_text: 'RDS connection problems', category: 'troubleshooting', aws_service: 'rds' },
  { suggestion_text: 'CloudFormation stack creation failed', category: 'troubleshooting', aws_service: 'cloudformation' },

  // Service-specific Questions
  { suggestion_text: 'How to enable S3 versioning?', category: 'service-specific', aws_service: 's3' },
  { suggestion_text: 'DynamoDB best practices', category: 'service-specific', aws_service: 'dynamodb' },
  { suggestion_text: 'Lambda environment variables', category: 'service-specific', aws_service: 'lambda' },
  { suggestion_text: 'CloudWatch custom metrics', category: 'service-specific', aws_service: 'cloudwatch' },
  { suggestion_text: 'ECS task definitions', category: 'service-specific', aws_service: 'ecs' },

  // CDK Questions
  { suggestion_text: 'How to get started with AWS CDK?', category: 'general', aws_service: 'cdk' },
  { suggestion_text: 'CDK construct examples', category: 'service-specific', aws_service: 'cdk' },
  { suggestion_text: 'CDK deployment best practices', category: 'service-specific', aws_service: 'cdk' },

  // Security Questions
  { suggestion_text: 'How to secure S3 buckets?', category: 'security', aws_service: 's3' },
  { suggestion_text: 'IAM policy examples', category: 'security', aws_service: 'iam' },
  { suggestion_text: 'VPC security groups configuration', category: 'security', aws_service: 'vpc' },
];

/**
 * Seed the database with initial data
 */
export const seedDatabase = async (): Promise<void> => {
  try {
    const db = databaseManager.getDatabase();
    
    logger.info('Starting database seeding...');

    // Seed AWS services
    const insertService = db.prepare(`
      INSERT OR IGNORE INTO aws_services 
      (service_name, service_code, category, description, documentation_url) 
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertServicesTransaction = db.transaction((services: any[]) => {
      for (const service of services) {
        insertService.run(
          service.service_name,
          service.service_code,
          service.category,
          service.description,
          service.documentation_url
        );
      }
    });

    insertServicesTransaction(AWS_SERVICES_SEED);
    logger.info(`Seeded ${AWS_SERVICES_SEED.length} AWS services`);

    // Seed question suggestions
    const insertSuggestion = db.prepare(`
      INSERT OR IGNORE INTO question_suggestions 
      (suggestion_text, category, aws_service) 
      VALUES (?, ?, ?)
    `);

    const insertSuggestionsTransaction = db.transaction((suggestions: any[]) => {
      for (const suggestion of suggestions) {
        insertSuggestion.run(
          suggestion.suggestion_text,
          suggestion.category,
          suggestion.aws_service
        );
      }
    });

    insertSuggestionsTransaction(QUESTION_SUGGESTIONS_SEED);
    logger.info(`Seeded ${QUESTION_SUGGESTIONS_SEED.length} question suggestions`);

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed', { error: getErrorMessage(error) });
    throw error;
  }
};

/**
 * Clear all seed data (for testing)
 */
export const clearSeedData = async (): Promise<void> => {
  try {
    const db = databaseManager.getDatabase();
    
    db.prepare('DELETE FROM question_suggestions').run();
    db.prepare('DELETE FROM aws_services').run();
    
    logger.info('Seed data cleared');
  } catch (error) {
    logger.error('Failed to clear seed data', { error: getErrorMessage(error) });
    throw error;
  }
};