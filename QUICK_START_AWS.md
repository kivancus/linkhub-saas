# 🚀 Quick Start: Deploy LinkHub SaaS to AWS

## Two Deployment Methods

### Method 1: Direct Deployment (5 minutes)
### Method 2: GitHub Actions CI/CD (10 minutes)

---

## Method 1: Direct Deployment ⚡

### Step 1: Install Prerequisites
```bash
# Install AWS CLI (if not installed)
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

### Step 2: Set Up Secrets (Optional but Recommended)
```bash
# Run the secrets setup script
./setup-aws-secrets.sh us-east-1

# This will prompt you for:
# - Stripe secret key
# - Stripe webhook secret
# - Email configuration
# - Database URL (optional)
```

### Step 3: Deploy to AWS
```bash
# Deploy to AWS App Runner
./deploy-scripts/aws-deploy.sh production us-east-1
```

### Step 4: Test Your Application
- Visit the provided App Runner URL
- Test user registration and login
- Create a bio page and add links
- Test the public bio page

---

## Method 2: GitHub Actions CI/CD 🔄

### Step 1: Add AWS Secrets to GitHub
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add these repository secrets:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
   - `AWS_REGION`: us-east-1 (or your preferred region)

### Step 2: Set Up Application Secrets (Optional)
```bash
# Run locally to set up AWS Parameter Store
./setup-aws-secrets.sh us-east-1
```

### Step 3: Deploy via GitHub
```bash
# Push to main branch to trigger deployment
git add .
git commit -m "Deploy to AWS"
git push origin main
```

### Step 4: Monitor Deployment
- Go to GitHub → Actions tab
- Watch the deployment progress
- Get the deployed URL from the workflow summary

---

## What Happens During Deployment

### 🏗️ Build Process
1. **Test**: Runs your test suite
2. **Build**: Compiles TypeScript to JavaScript
3. **Docker**: Creates optimized container image
4. **Push**: Uploads to AWS ECR (Elastic Container Registry)

### 🚀 Deployment Process
1. **Service Creation**: Creates AWS App Runner service
2. **Health Checks**: Configures `/health` endpoint monitoring
3. **Auto Scaling**: Sets up automatic scaling (1-25 instances)
4. **HTTPS**: Automatic SSL certificate and HTTPS

### 📊 Infrastructure Created
- **AWS App Runner Service**: Hosts your application
- **ECR Repository**: Stores your Docker images
- **CloudWatch Logs**: Application logging
- **IAM Roles**: Security permissions

---

## Cost Breakdown

### AWS App Runner Costs
- **Compute**: ~$25-50/month (small traffic)
- **Data Transfer**: ~$5-10/month
- **ECR Storage**: ~$1-2/month
- **Total**: ~$30-60/month

### Free Tier Benefits
- First 2 months: 50% discount on compute
- ECR: 500MB free storage
- CloudWatch: Basic monitoring included

---

## Environment Variables

### Automatically Configured
- `NODE_ENV=production`
- `PORT=3000`

### From AWS Parameter Store (if configured)
- `JWT_SECRET`: Authentication secret
- `STRIPE_SECRET_KEY`: Stripe payments
- `STRIPE_WEBHOOK_SECRET`: Stripe webhooks
- `DATABASE_URL`: Database connection
- `EMAIL_*`: Email configuration

---

## Post-Deployment Steps

### 1. Update Frontend URL
```bash
# Get your App Runner URL from deployment output
SERVICE_URL="your-app-runner-url.us-east-1.awsapprunner.com"

# Update the frontend URL parameter
aws ssm put-parameter \
  --name "/linkhub/frontend-url" \
  --value "https://$SERVICE_URL" \
  --type "String" \
  --overwrite
```

### 2. Configure Stripe Webhooks
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-app-runner-url/api/webhooks/stripe`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 3. Test Everything
- [ ] User registration works
- [ ] Email verification works
- [ ] Bio page creation works
- [ ] Link clicks are tracked
- [ ] Subscription flow works
- [ ] Stripe webhooks work

---

## Monitoring and Logs

### View Application Logs
```bash
# Real-time logs
aws logs tail /aws/apprunner/linkhub-saas-production --follow

# Recent logs
aws logs tail /aws/apprunner/linkhub-saas-production --since 1h
```

### Health Check
```bash
# Check service health
curl https://your-app-runner-url/health
```

### Service Status
```bash
# Get service details
aws apprunner describe-service --service-arn <service-arn>
```

---

## Updating Your Application

### Method 1: Direct Update
```bash
# Run deployment script again
./deploy-scripts/aws-deploy.sh production us-east-1
```

### Method 2: GitHub Actions
```bash
# Push changes to trigger auto-deployment
git add .
git commit -m "Update application"
git push origin main
```

---

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs in GitHub Actions or locally
npm test
npm run build
```

#### 2. Health Check Failures
- Ensure `/health` endpoint returns 200
- Check application logs for startup errors
- Verify port 3000 is exposed

#### 3. Environment Variable Issues
```bash
# List all parameters
aws ssm get-parameters-by-path --path "/linkhub" --recursive

# Update a parameter
aws ssm put-parameter --name "/linkhub/jwt-secret" --value "new-value" --type "SecureString" --overwrite
```

#### 4. Database Connection Issues
- Check DATABASE_URL format
- Ensure database is accessible
- Verify connection string

### Debug Commands
```bash
# Service logs
aws logs tail /aws/apprunner/linkhub-saas-production

# Service status
aws apprunner list-services

# Parameter values (non-secure only)
aws ssm get-parameters-by-path --path "/linkhub" --recursive
```

---

## Security Features

### Built-in Security
- ✅ HTTPS/TLS encryption
- ✅ VPC isolation
- ✅ IAM role-based access
- ✅ Automatic security patches
- ✅ DDoS protection

### Application Security
- ✅ Rate limiting
- ✅ Helmet.js security headers
- ✅ CORS protection
- ✅ Input validation
- ✅ JWT authentication

---

## Scaling and Performance

### Auto Scaling
- **Min instances**: 1
- **Max instances**: 25
- **Concurrent requests**: 100 per instance
- **CPU**: 0.25 vCPU per instance
- **Memory**: 0.5 GB per instance

### Performance Optimization
- Docker multi-stage builds
- Gzip compression
- Static file caching
- Database connection pooling

---

## Next Steps

### 1. Custom Domain (Optional)
- Purchase domain from Route 53 or external registrar
- Configure in App Runner console
- Update environment variables

### 2. Database Upgrade (Optional)
- Set up Amazon RDS PostgreSQL
- Update DATABASE_URL parameter
- Run database migrations

### 3. Monitoring Setup
- CloudWatch dashboards
- Error alerting
- Performance monitoring
- Cost monitoring

### 4. Backup Strategy
- Database backups
- Code repository backups
- Configuration backups

---

## Support

### AWS Resources
- [App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [CloudWatch Logs Console](https://console.aws.amazon.com/cloudwatch/home#logsV2:)
- [Systems Manager Console](https://console.aws.amazon.com/systems-manager/parameters)

### Application Support
- Check `/health` endpoint: `https://your-url/health`
- Review application logs in CloudWatch
- Test API endpoints individually

---

## Success Checklist

- [ ] AWS CLI installed and configured
- [ ] Application deployed successfully
- [ ] Health check passes
- [ ] User registration works
- [ ] Bio pages display correctly
- [ ] Stripe integration works
- [ ] Email notifications work
- [ ] Analytics tracking works
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up

**🎉 Congratulations! Your LinkHub SaaS is now live on AWS!**