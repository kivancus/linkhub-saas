#!/bin/bash
set -e

# AWS Secrets Setup Script for LinkHub SaaS
# This script sets up all required environment variables in AWS Systems Manager Parameter Store

REGION=${1:-us-east-1}

echo "🔐 Setting up AWS Secrets for LinkHub SaaS"
echo "Region: $REGION"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured.${NC}"
    echo -e "${YELLOW}Please run: aws configure${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Setting up required secrets...${NC}"

# Generate JWT secret if not provided
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✅ Generated JWT secret${NC}"

# Prompt for Stripe keys
echo ""
echo -e "${YELLOW}🔑 Stripe Configuration${NC}"
echo "You can find these in your Stripe Dashboard (https://dashboard.stripe.com/apikeys)"
echo ""

read -p "Enter your Stripe Secret Key (sk_test_... or sk_live_...): " STRIPE_SECRET_KEY
if [[ ! $STRIPE_SECRET_KEY =~ ^sk_(test|live)_ ]]; then
    echo -e "${RED}❌ Invalid Stripe secret key format${NC}"
    exit 1
fi

read -p "Enter your Stripe Webhook Secret (whsec_...): " STRIPE_WEBHOOK_SECRET
if [[ ! $STRIPE_WEBHOOK_SECRET =~ ^whsec_ ]]; then
    echo -e "${RED}❌ Invalid Stripe webhook secret format${NC}"
    exit 1
fi

# Email configuration
echo ""
echo -e "${YELLOW}📧 Email Configuration${NC}"
echo "For Gmail, use an App Password (not your regular password)"
echo ""

read -p "Enter your email host (e.g., smtp.gmail.com): " EMAIL_HOST
read -p "Enter your email port (e.g., 587): " EMAIL_PORT
read -p "Enter your email address: " EMAIL_USER
read -s -p "Enter your email password/app password: " EMAIL_PASS
echo ""

# Database URL (default to SQLite)
DATABASE_URL="file:./prod.db"
echo ""
echo -e "${YELLOW}🗄️  Database Configuration${NC}"
echo "Default: SQLite (file:./prod.db)"
read -p "Enter custom DATABASE_URL (or press Enter for SQLite): " CUSTOM_DB_URL
if [ ! -z "$CUSTOM_DB_URL" ]; then
    DATABASE_URL="$CUSTOM_DB_URL"
fi

# Frontend URL
echo ""
echo -e "${YELLOW}🌐 Frontend URL${NC}"
echo "This will be updated after deployment with your App Runner URL"
FRONTEND_URL="https://localhost:3000"

echo ""
echo -e "${BLUE}💾 Storing secrets in AWS Systems Manager Parameter Store...${NC}"

# Store all secrets
aws ssm put-parameter --name "/linkhub/jwt-secret" --value "$JWT_SECRET" --type "SecureString" --region $REGION --overwrite
echo -e "${GREEN}✅ JWT secret stored${NC}"

aws ssm put-parameter --name "/linkhub/stripe-secret-key" --value "$STRIPE_SECRET_KEY" --type "SecureString" --region $REGION --overwrite
echo -e "${GREEN}✅ Stripe secret key stored${NC}"

aws ssm put-parameter --name "/linkhub/stripe-webhook-secret" --value "$STRIPE_WEBHOOK_SECRET" --type "SecureString" --region $REGION --overwrite
echo -e "${GREEN}✅ Stripe webhook secret stored${NC}"

aws ssm put-parameter --name "/linkhub/database-url" --value "$DATABASE_URL" --type "SecureString" --region $REGION --overwrite
echo -e "${GREEN}✅ Database URL stored${NC}"

aws ssm put-parameter --name "/linkhub/email-host" --value "$EMAIL_HOST" --type "String" --region $REGION --overwrite
echo -e "${GREEN}✅ Email host stored${NC}"

aws ssm put-parameter --name "/linkhub/email-port" --value "$EMAIL_PORT" --type "String" --region $REGION --overwrite
echo -e "${GREEN}✅ Email port stored${NC}"

aws ssm put-parameter --name "/linkhub/email-user" --value "$EMAIL_USER" --type "String" --region $REGION --overwrite
echo -e "${GREEN}✅ Email user stored${NC}"

aws ssm put-parameter --name "/linkhub/email-pass" --value "$EMAIL_PASS" --type "SecureString" --region $REGION --overwrite
echo -e "${GREEN}✅ Email password stored${NC}"

aws ssm put-parameter --name "/linkhub/frontend-url" --value "$FRONTEND_URL" --type "String" --region $REGION --overwrite
echo -e "${GREEN}✅ Frontend URL stored${NC}"

echo ""
echo -e "${GREEN}🎉 All secrets configured successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Summary of stored parameters:${NC}"
echo "• /linkhub/jwt-secret"
echo "• /linkhub/stripe-secret-key"
echo "• /linkhub/stripe-webhook-secret"
echo "• /linkhub/database-url"
echo "• /linkhub/email-host"
echo "• /linkhub/email-port"
echo "• /linkhub/email-user"
echo "• /linkhub/email-pass"
echo "• /linkhub/frontend-url"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "1. Update /linkhub/frontend-url after deployment with your App Runner URL"
echo "2. Configure Stripe webhook endpoint after deployment"
echo "3. Test email functionality after deployment"
echo ""
echo -e "${BLUE}🛠️  Useful commands:${NC}"
echo "List all parameters: aws ssm get-parameters-by-path --path '/linkhub' --recursive --region $REGION"
echo "Update a parameter: aws ssm put-parameter --name '/linkhub/parameter-name' --value 'new-value' --type 'SecureString' --overwrite --region $REGION"
echo ""
echo -e "${GREEN}✅ Ready for deployment! Run: ./deploy-scripts/aws-deploy.sh${NC}"