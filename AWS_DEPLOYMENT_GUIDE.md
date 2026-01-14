# AWS Deployment Guide - Two Methods

## Method 1: Direct Deployment (Quick Start)

### Prerequisites
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### Quick Deploy
```bash
# Make script executable
chmod +x deploy-scripts/aws-deploy.sh

# Deploy to AWS App Runner
./deploy-scripts/aws-deploy.sh production us-east-1
```

### What the Script Does
1. Creates ECR repository for your Docker images
2. Builds and pushes Docker image to ECR
3. Creates/updates App Runner service
4. Configures health checks and auto-scaling
5. Provides your live URL

## Method 2: GitHub Actions CI/CD (Automated)

### Setup Steps

1. **Add AWS Secrets to GitHub**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Add these secrets:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_REGION` (e.g., us-east-1)

2. **GitHub Actions will automatically deploy on push to main**

### Workflow Features
- ✅ Automatic deployment on code changes
- ✅ Build and test before deployment
- ✅ Zero-downtime deployments
- ✅ Rollback capability
- ✅ Environment-specific deployments

## Environment Variables Setup

### Required Environment Variables
```bash
# Production secrets (set these in AWS Systems Manager)
JWT_SECRET=your-super-secure-jwt-secret-here
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
DATABASE_URL=file:./prod.db
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=https://your-app-runner-url.com
```

### Set Secrets in AWS
```bash
# Store secrets in AWS Systems Manager Parameter Store
aws ssm put-parameter --name "/linkhub/jwt-secret" --value "your-jwt-secret" --type "SecureString"
aws ssm put-parameter --name "/linkhub/stripe-secret" --value "sk_live_..." --type "SecureString"
aws ssm put-parameter --name "/linkhub/stripe-webhook-secret" --value "whsec_..." --type "SecureString"
```

## Database Options

### Option 1: SQLite (Simple, included)
- Already configured in your app
- Perfect for getting started
- No additional setup needed
- Data persists in container

### Option 2: Amazon RDS (Scalable)
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier linkhub-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username linkuser \
  --master-user-password your-secure-password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxxxx

# Update DATABASE_URL in Parameter Store
aws ssm put-parameter --name "/linkhub/database-url" \
  --value "postgresql://linkuser:password@linkhub-db.xyz.us-east-1.rds.amazonaws.com:5432/linkhub" \
  --type "SecureString"
```

## Monitoring and Logs

### View Application Logs
```bash
# Get service ARN
SERVICE_ARN=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='linkhub-saas-production'].ServiceArn" --output text)

# View logs in CloudWatch
aws logs tail /aws/apprunner/linkhub-saas-production --follow
```

### Health Check
Your app will be available at the App Runner URL with automatic health checks at `/health`

## Scaling Configuration

### Auto Scaling (Default)
- Min instances: 1
- Max instances: 25
- Concurrent requests per instance: 100
- CPU: 0.25 vCPU
- Memory: 0.5 GB

### Custom Scaling
```bash
# Update service with more resources
aws apprunner update-service \
  --service-arn $SERVICE_ARN \
  --instance-configuration Cpu=1vCPU,Memory=2GB
```

## Cost Estimation

### App Runner Costs
- **Compute**: ~$25-50/month (small traffic)
- **Data transfer**: ~$5-10/month
- **Total**: ~$30-60/month

### Additional Costs (Optional)
- **RDS db.t3.micro**: ~$15/month
- **CloudFront CDN**: ~$5-10/month
- **Route 53 (domain)**: ~$0.50/month

## Security Features

### Built-in Security
- ✅ HTTPS/TLS encryption
- ✅ VPC isolation
- ✅ IAM role-based access
- ✅ Automatic security patches
- ✅ DDoS protection

### Additional Security
- Rate limiting (already configured)
- Helmet.js security headers
- CORS protection
- Input validation

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   aws apprunner describe-service --service-arn $SERVICE_ARN
   ```

2. **Environment Variables**
   ```bash
   # List parameters
   aws ssm get-parameters-by-path --path "/linkhub" --recursive
   ```

3. **Health Check Failures**
   - Ensure `/health` endpoint returns 200
   - Check application logs
   - Verify port 3000 is exposed

### Debug Commands
```bash
# Service status
aws apprunner describe-service --service-arn $SERVICE_ARN

# Recent deployments
aws apprunner list-operations --service-arn $SERVICE_ARN

# Application logs
aws logs tail /aws/apprunner/linkhub-saas-production
```

## Next Steps After Deployment

1. **Test Your Application**
   - Visit the provided App Runner URL
   - Test user registration and login
   - Create a bio page and test links
   - Test subscription flow

2. **Configure Stripe Webhooks**
   - Go to Stripe Dashboard
   - Add webhook: `https://your-app-runner-url/api/webhooks/stripe`
   - Select events: `customer.subscription.*`, `invoice.*`

3. **Set Up Monitoring**
   - CloudWatch dashboards
   - Error alerts
   - Performance monitoring

4. **Custom Domain (Later)**
   - Purchase domain
   - Configure in App Runner console
   - Update environment variables

## Support

### AWS Resources
- [App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:)
- [Systems Manager Parameters](https://console.aws.amazon.com/systems-manager/parameters)

### Application Support
- Check `/health` endpoint for service status
- Review application logs for errors
- Test API endpoints individually