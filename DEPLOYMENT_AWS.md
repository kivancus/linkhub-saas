# AWS Deployment Guide for LinkHub SaaS

## Overview
This guide covers deploying LinkHub SaaS to AWS using multiple deployment options.

## Option 1: AWS App Runner (Recommended - Easiest)

### Prerequisites
- AWS CLI installed and configured
- Docker installed locally

### Steps

1. **Create Dockerfile for production** (already exists)
2. **Push to ECR or use GitHub integration**
3. **Create App Runner service**

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t linkhub-saas .
docker tag linkhub-saas:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest
```

### App Runner Configuration
```yaml
# apprunner.yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm install
      - npm run build
      - npm run db:generate
run:
  runtime-version: 18
  command: npm start
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
    - name: DATABASE_URL
      value: file:./prod.db
```

## Option 2: AWS ECS with Fargate

### 1. Create ECS Task Definition
```json
{
  "family": "linkhub-saas",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<account>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "linkhub-saas",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account>:secret:linkhub/jwt-secret"
        },
        {
          "name": "STRIPE_SECRET_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account>:secret:linkhub/stripe-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/linkhub-saas",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Option 3: AWS Lambda with Serverless Framework

### Install Serverless Framework
```bash
npm install -g serverless
npm install --save-dev serverless-http
```

### Create serverless.yml
```yaml
service: linkhub-saas

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    NODE_ENV: production
    JWT_SECRET: ${env:JWT_SECRET}
    STRIPE_SECRET_KEY: ${env:STRIPE_SECRET_KEY}
    DATABASE_URL: ${env:DATABASE_URL}

functions:
  app:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
      - http:
          path: /
          method: ANY
          cors: true
    timeout: 30

plugins:
  - serverless-offline

custom:
  serverless-offline:
    httpPort: 3000
```

## Database Options

### Option A: Amazon RDS (PostgreSQL)
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier linkhub-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username linkuser \
  --master-user-password <secure-password> \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxxxx
```

### Option B: Amazon RDS Serverless v2
```yaml
# CloudFormation template
Resources:
  LinkHubDatabase:
    Type: AWS::RDS::DBCluster
    Properties:
      Engine: aurora-postgresql
      EngineMode: provisioned
      ServerlessV2ScalingConfiguration:
        MinCapacity: 0.5
        MaxCapacity: 1
      MasterUsername: linkuser
      MasterUserPassword: !Ref DatabasePassword
      DatabaseName: linkhub
```

## Environment Variables Setup

### AWS Systems Manager Parameter Store
```bash
# Store secrets
aws ssm put-parameter --name "/linkhub/jwt-secret" --value "your-jwt-secret" --type "SecureString"
aws ssm put-parameter --name "/linkhub/stripe-secret" --value "sk_live_..." --type "SecureString"
aws ssm put-parameter --name "/linkhub/database-url" --value "postgresql://..." --type "SecureString"
```

## CDN and Static Assets

### CloudFront Distribution
```yaml
# CloudFormation
Resources:
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - Id: AppRunnerOrigin
            DomainName: !GetAtt AppRunnerService.ServiceUrl
            CustomOriginConfig:
              HTTPPort: 443
              OriginProtocolPolicy: https-only
        DefaultCacheBehavior:
          TargetOriginId: AppRunnerOrigin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad # Managed-CachingDisabled
        Enabled: true
        Aliases:
          - yourdomain.com
        ViewerCertificate:
          AcmCertificateArn: !Ref SSLCertificate
          SslSupportMethod: sni-only
```

## Domain and SSL

### Route 53 and ACM
```bash
# Request SSL certificate
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS

# Create Route 53 hosted zone
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)
```

## Monitoring and Logging

### CloudWatch Setup
```yaml
Resources:
  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: /aws/apprunner/linkhub-saas
      RetentionInDays: 30

  ErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: LinkHub-HighErrorRate
      MetricName: 4XXError
      Namespace: AWS/AppRunner
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
```

## Cost Estimation

### App Runner (Recommended)
- **Compute**: ~$25-50/month for small traffic
- **Database**: RDS t3.micro ~$15/month
- **Total**: ~$40-65/month

### ECS Fargate
- **Compute**: ~$15-30/month
- **Load Balancer**: ~$20/month
- **Database**: ~$15/month
- **Total**: ~$50-65/month

### Lambda (Serverless)
- **Compute**: ~$5-20/month (depending on traffic)
- **Database**: ~$15/month
- **API Gateway**: ~$3-10/month
- **Total**: ~$23-45/month

## Quick Deploy Script

Create `deploy-aws.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 Deploying LinkHub SaaS to AWS..."

# Build application
npm run build

# Deploy with App Runner (easiest option)
aws apprunner create-service \
  --service-name linkhub-saas \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "'$ECR_IMAGE_URI'",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": true
  }' \
  --instance-configuration '{
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  }'

echo "✅ Deployment initiated! Check AWS Console for status."
```

## Next Steps

1. Choose deployment option (App Runner recommended for simplicity)
2. Set up database (RDS or Aurora Serverless)
3. Configure environment variables
4. Set up domain and SSL certificate
5. Configure monitoring and alerts
6. Test the deployment

## Support

For issues with AWS deployment:
- Check CloudWatch logs
- Verify environment variables
- Ensure security groups allow traffic
- Check IAM permissions