#!/bin/bash
set -e

# AWS Deployment Script for LinkHub SaaS
# Usage: ./deploy-scripts/aws-deploy.sh [environment] [region]

ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
APP_NAME="linkhub-saas"
ECR_REPO_NAME="linkhub-saas"

echo "🚀 Deploying LinkHub SaaS to AWS App Runner..."
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed.${NC}"
    echo -e "${YELLOW}Please install it first:${NC}"
    echo "curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o \"awscliv2.zip\""
    echo "unzip awscliv2.zip && sudo ./aws/install"
    echo "aws configure"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed.${NC}"
    echo -e "${YELLOW}Please install Docker first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured.${NC}"
    echo -e "${YELLOW}Please run: aws configure${NC}"
    exit 1
fi

# Get AWS account ID
echo -e "${BLUE}📋 Getting AWS account information...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
IMAGE_URI="$ECR_URI/$ECR_REPO_NAME:latest"

echo -e "${GREEN}✅ AWS Account ID: $ACCOUNT_ID${NC}"
echo -e "${GREEN}✅ ECR URI: $ECR_URI${NC}"
echo -e "${GREEN}✅ Image URI: $IMAGE_URI${NC}"
echo ""

# Create ECR repository if it doesn't exist
echo -e "${BLUE}📦 Setting up ECR repository...${NC}"
if aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $REGION &>/dev/null; then
    echo -e "${GREEN}✅ ECR repository already exists${NC}"
else
    echo -e "${YELLOW}⚡ Creating ECR repository...${NC}"
    aws ecr create-repository --repository-name $ECR_REPO_NAME --region $REGION
    echo -e "${GREEN}✅ ECR repository created${NC}"
fi

# Login to ECR
echo -e "${BLUE}🔐 Logging in to ECR...${NC}"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI
echo -e "${GREEN}✅ Successfully logged in to ECR${NC}"

# Build Docker image
echo -e "${BLUE}🏗️  Building Docker image...${NC}"
echo "This may take a few minutes..."
docker build -t $ECR_REPO_NAME . --quiet
docker tag $ECR_REPO_NAME:latest $IMAGE_URI
echo -e "${GREEN}✅ Docker image built successfully${NC}"

# Push to ECR
echo -e "${BLUE}📤 Pushing image to ECR...${NC}"
echo "This may take a few minutes..."
docker push $IMAGE_URI --quiet
echo -e "${GREEN}✅ Image pushed to ECR successfully${NC}"

# Check if App Runner service exists
echo -e "${BLUE}🔍 Checking if App Runner service exists...${NC}"
SERVICE_EXISTS=$(aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME-$ENVIRONMENT'].ServiceName" --output text)

if [ -z "$SERVICE_EXISTS" ]; then
    echo -e "${YELLOW}⚡ Creating new App Runner service...${NC}"
    
    # Create App Runner service configuration
    cat > apprunner-config.json << EOF
{
  "ServiceName": "$APP_NAME-$ENVIRONMENT",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$IMAGE_URI",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "$ENVIRONMENT",
          "PORT": "3000"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": true
  },
  "InstanceConfiguration": {
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 20,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  },
  "Tags": [
    {
      "Key": "Environment",
      "Value": "$ENVIRONMENT"
    },
    {
      "Key": "Application",
      "Value": "linkhub-saas"
    }
  ]
}
EOF
    
    aws apprunner create-service --cli-input-json file://apprunner-config.json --region $REGION
    echo -e "${GREEN}✅ App Runner service created successfully!${NC}"
else
    echo -e "${YELLOW}🔄 Updating existing App Runner service...${NC}"
    
    # Get service ARN
    SERVICE_ARN=$(aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME-$ENVIRONMENT'].ServiceArn" --output text)
    
    # Create update configuration
    cat > apprunner-update-config.json << EOF
{
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$IMAGE_URI",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "$ENVIRONMENT",
          "PORT": "3000"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": true
  }
}
EOF
    
    # Update service
    aws apprunner update-service --service-arn $SERVICE_ARN --source-configuration file://apprunner-update-config.json --region $REGION
    echo -e "${GREEN}✅ App Runner service updated successfully!${NC}"
fi

# Clean up temporary files
rm -f apprunner-config.json apprunner-update-config.json

# Wait for service to be ready
echo -e "${BLUE}⏳ Waiting for service to be ready...${NC}"
echo "This may take 3-5 minutes for the first deployment..."

SERVICE_ARN=$(aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME-$ENVIRONMENT'].ServiceArn" --output text)

# Wait for service to be running
aws apprunner wait service-running --service-arn "$SERVICE_ARN" --region $REGION

# Get service URL
SERVICE_URL=$(aws apprunner describe-service --service-arn "$SERVICE_ARN" --region $REGION --query "Service.ServiceUrl" --output text)

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Your LinkHub SaaS is available at: https://$SERVICE_URL${NC}"
echo ""

# Test health endpoint
echo -e "${BLUE}🏥 Testing health endpoint...${NC}"
sleep 10
if curl -f -s "https://$SERVICE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed - service may still be starting up${NC}"
fi

echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Test your application: https://$SERVICE_URL"
echo "2. Set up environment variables:"
echo "   aws ssm put-parameter --name '/linkhub/jwt-secret' --value 'your-secret' --type 'SecureString'"
echo "   aws ssm put-parameter --name '/linkhub/stripe-secret' --value 'sk_live_...' --type 'SecureString'"
echo "3. Configure Stripe webhooks: https://$SERVICE_URL/api/webhooks/stripe"
echo "4. Set up custom domain (optional)"
echo ""
echo -e "${BLUE}🛠️  Useful commands:${NC}"
echo "View logs: aws logs tail /aws/apprunner/$APP_NAME-$ENVIRONMENT --follow"
echo "Service status: aws apprunner describe-service --service-arn $SERVICE_ARN"
echo ""
echo -e "${GREEN}💡 To update the service, run this script again.${NC}"