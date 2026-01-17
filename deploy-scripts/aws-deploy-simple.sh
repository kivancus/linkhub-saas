#!/bin/bash
set -e

# Simple AWS Deployment Script for LinkHub SaaS
# This script handles everything including IAM role creation

REGION=${1:-us-east-1}
APP_NAME="linkhub-saas"
ROLE_NAME="AppRunnerECRAccessRole"

echo "🚀 Starting LinkHub SaaS deployment to AWS..."
echo "Region: $REGION"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command -v aws >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker not found. Please install it first.${NC}"
    exit 1
fi

# Get AWS account info
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}❌ AWS credentials not configured. Run: aws configure${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS Account: $ACCOUNT_ID${NC}"
echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Step 1: Create IAM role if it doesn't exist
echo -e "${BLUE}🔐 Setting up IAM role...${NC}"

if aws iam get-role --role-name $ROLE_NAME >/dev/null 2>&1; then
    echo -e "${GREEN}✅ IAM role already exists${NC}"
else
    echo -e "${YELLOW}⚡ Creating IAM role for App Runner...${NC}"
    
    # Create trust policy
    cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "build.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create role
    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file://trust-policy.json \
        --description "Role for App Runner to access ECR"

    # Attach ECR read policy
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

    echo -e "${GREEN}✅ IAM role created successfully${NC}"
    rm trust-policy.json
fi

# Step 2: Create ECR repository
echo -e "${BLUE}📦 Setting up ECR repository...${NC}"

if aws ecr describe-repositories --repository-names $APP_NAME --region $REGION >/dev/null 2>&1; then
    echo -e "${GREEN}✅ ECR repository already exists${NC}"
else
    aws ecr create-repository --repository-name $APP_NAME --region $REGION
    echo -e "${GREEN}✅ ECR repository created${NC}"
fi

# Step 3: Build and push Docker image
echo -e "${BLUE}🏗️  Building and pushing Docker image...${NC}"

ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
IMAGE_URI="$ECR_URI/$APP_NAME:latest"

# Login to ECR
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

# Build and push
docker build -t $APP_NAME .
docker tag $APP_NAME:latest $IMAGE_URI
docker push $IMAGE_URI

echo -e "${GREEN}✅ Image pushed successfully${NC}"

# Step 4: Create or update App Runner service
echo -e "${BLUE}🚀 Creating App Runner service...${NC}"

SERVICE_EXISTS=$(aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceName" --output text 2>/dev/null || echo "")

if [ -z "$SERVICE_EXISTS" ]; then
    echo -e "${YELLOW}⚡ Creating new App Runner service...${NC}"
    
    # Create service
    cat > service-config.json << EOF
{
  "ServiceName": "$APP_NAME",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$IMAGE_URI",
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
    "InstanceRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
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

    aws apprunner create-service --cli-input-json file://service-config.json --region $REGION
    rm service-config.json
    
    echo -e "${GREEN}✅ App Runner service created${NC}"
else
    echo -e "${YELLOW}🔄 Updating existing service...${NC}"
    
    SERVICE_ARN=$(aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceArn" --output text)
    
    cat > update-config.json << EOF
{
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$IMAGE_URI",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3000"
        }
      },
      "ImageRepositoryType": "ECR"
    }
  }
}
EOF

    aws apprunner update-service --service-arn $SERVICE_ARN --source-configuration file://update-config.json --region $REGION
    rm update-config.json
    
    echo -e "${GREEN}✅ App Runner service updated${NC}"
fi

# Step 5: Wait for deployment and get URL
echo -e "${BLUE}⏳ Waiting for service to be ready...${NC}"

SERVICE_ARN=$(aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$APP_NAME'].ServiceArn" --output text)

# Wait for service to be running (this can take 3-5 minutes)
echo "This may take 3-5 minutes..."
aws apprunner wait service-running --service-arn "$SERVICE_ARN" --region $REGION

# Get service URL
SERVICE_URL=$(aws apprunner describe-service --service-arn "$SERVICE_ARN" --region $REGION --query "Service.ServiceUrl" --output text)

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Your LinkHub SaaS is live at: https://$SERVICE_URL${NC}"
echo ""

# Test health endpoint
echo -e "${BLUE}🏥 Testing application...${NC}"
sleep 10

if curl -f -s "https://$SERVICE_URL/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Application is healthy and running!${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed - service may still be starting${NC}"
    echo "You can check the status in AWS Console or try again in a few minutes."
fi

echo ""
echo -e "${BLUE}📋 What's next:${NC}"
echo "1. 🌐 Visit your app: https://$SERVICE_URL"
echo "2. 📊 View logs: AWS Console → App Runner → $APP_NAME → Logs"
echo "3. 🔧 Add environment variables if needed"
echo "4. 🌍 Set up custom domain (optional)"
echo ""
echo -e "${GREEN}💡 To redeploy, just run this script again!${NC}"