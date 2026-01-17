# Quick Start AWS Deployment Guide

## Prerequisites Setup

### 1. Install AWS CLI (if not already installed)
```bash
# Check if AWS CLI is installed
aws --version

# If not installed, install it:
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install
```

### 2. Configure AWS Credentials
```bash
aws configure
```
Enter your credentials:
- AWS Access Key ID: [Your Access Key]
- AWS Secret Access Key: [Your Secret Key]  
- Default region name: us-east-1
- Default output format: json

### 3. Verify Setup
```bash
# Test AWS connection
aws sts get-caller-identity

# Check Docker is running
docker --version
```

## Quick Deploy Commands

### Option 1: Use Our Deploy Script (Recommended)
```bash
# Make script executable
chmod +x deploy-scripts/aws-deploy.sh

# Deploy to production
./deploy-scripts/aws-deploy.sh production us-east-1
```

### Option 2: Manual Step-by-Step

#### Step 1: Create ECR Repository
```bash
aws ecr create-repository --repository-name linkhub-saas --region us-east-1
```

#### Step 2: Build and Push Docker Image
```bash
# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and tag image
docker build -t linkhub-saas .
docker tag linkhub-saas:latest $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest

# Push image
docker push $ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest
```

#### Step 3: Create App Runner Service
```bash
# Create service configuration file
cat > apprunner-service.json << EOF
{
  "ServiceName": "linkhub-saas-production",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3000"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": true
  },
  "InstanceConfiguration": {
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB",
    "InstanceRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/AppRunnerECRAccessRole"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 20,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }
}
EOF

# Create the service
aws apprunner create-service --cli-input-json file://apprunner-service.json --region us-east-1
```

## Troubleshooting

### Common Issues:

1. **"App Runner not found in service list"**
   - Make sure you're in a supported region (us-east-1, us-west-2, etc.)
   - Create the IAM role manually as described above

2. **"Access Denied" errors**
   - Verify your IAM user has the required permissions
   - Check that the AppRunnerECRAccessRole exists

3. **Docker build fails**
   - Make sure Docker is running
   - Check that you're in the project root directory

4. **Service fails to start**
   - Check App Runner logs in AWS Console
   - Verify the health endpoint returns 200 status

### Getting Service URL:
```bash
# List services to get ARN
aws apprunner list-services --region us-east-1

# Get service details including URL
aws apprunner describe-service --service-arn [SERVICE_ARN] --region us-east-1
```

## Next Steps After Deployment

1. **Test the application**: Visit the provided App Runner URL
2. **Set up environment variables** (if needed):
   ```bash
   aws ssm put-parameter --name "/linkhub/jwt-secret" --value "your-jwt-secret-here" --type "SecureString"
   ```
3. **Configure custom domain** (optional)
4. **Set up monitoring and alerts**

## Cost Estimate
- App Runner: ~$25-50/month for small traffic
- ECR storage: ~$1-5/month
- **Total: ~$26-55/month**