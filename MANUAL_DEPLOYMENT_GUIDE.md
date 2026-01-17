# Manual AWS App Runner Deployment Guide

## ✅ What We've Accomplished So Far

1. **✅ Docker Image Built and Pushed Successfully**
   - Image URI: `893519145403.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest`
   - Also available in us-west-2: `893519145403.dkr.ecr.us-west-2.amazonaws.com/linkhub-saas:latest`

2. **✅ IAM Role Created**
   - Role Name: `AppRunnerECRAccessRole`
   - Has permissions to access ECR

3. **✅ ECR Repositories Created**
   - us-east-1: `linkhub-saas`
   - us-west-2: `linkhub-saas`

## 🎯 Next Step: Create App Runner Service Manually

Since the CLI approach had some issues, let's create the App Runner service through the AWS Console:

### Step 1: Go to AWS App Runner Console

1. **Open AWS Console** → Search for "App Runner"
2. **Click "Create service"**

### Step 2: Configure Source

1. **Source**: Select "Container registry"
2. **Provider**: Select "Amazon ECR"
3. **Container image URI**: 
   ```
   893519145403.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest
   ```
   (Or use us-west-2 if us-east-1 doesn't work)

4. **Deployment trigger**: Select "Automatic"
5. **ECR access role**: Select "AppRunnerECRAccessRole"

### Step 3: Configure Service

1. **Service name**: `linkhub-saas`
2. **Virtual CPU**: 0.25 vCPU
3. **Memory**: 0.5 GB
4. **Environment variables**:
   - `NODE_ENV` = `production`
   - `PORT` = `3000`

### Step 4: Configure Networking (Optional)

1. **Incoming traffic**: Public endpoint
2. **Outgoing traffic**: Default (allow all)

### Step 5: Configure Health Check

1. **Protocol**: HTTP
2. **Path**: `/health`
3. **Interval**: 20 seconds
4. **Timeout**: 5 seconds
5. **Healthy threshold**: 1
6. **Unhealthy threshold**: 5

### Step 6: Review and Create

1. **Review all settings**
2. **Click "Create & deploy"**
3. **Wait 3-5 minutes for deployment**

## 🎉 Expected Result

After deployment completes, you'll get:
- **Service URL**: `https://xxxxxxxxx.us-east-1.awsapprunner.com`
- **Status**: Running
- **Health Check**: Passing

## 🧪 Testing Your Deployment

Once deployed, test these endpoints:
1. **Health Check**: `https://your-url/health`
2. **Home Page**: `https://your-url/`
3. **API**: `https://your-url/api/themes`

## 💰 Cost Estimate

- **App Runner**: ~$25-50/month for small traffic
- **ECR Storage**: ~$1-5/month
- **Total**: ~$26-55/month

## 🔧 Alternative: EC2 Deployment

If App Runner doesn't work, we can deploy to EC2:

1. **Launch EC2 instance** (t3.micro for free tier)
2. **Install Docker** on the instance
3. **Pull and run** your Docker image
4. **Configure security groups** for port 3000

Would you like me to create an EC2 deployment script as backup?

## 📞 Support

If you encounter issues:
1. Check AWS Console → App Runner → Service logs
2. Verify the Docker image works locally: `docker run -p 3000:3000 linkhub-saas`
3. Ensure your region supports App Runner (try us-west-2 if us-east-1 fails)