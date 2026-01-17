#!/bin/bash
set -e

# AWS EC2 Deployment Script for LinkHub SaaS
# This script creates an EC2 instance and deploys the Docker container

REGION=${1:-us-east-1}
INSTANCE_TYPE=${2:-t3.micro}
KEY_NAME=${3:-linkhub-key}

echo "🚀 Deploying LinkHub SaaS to AWS EC2..."
echo "Region: $REGION"
echo "Instance Type: $INSTANCE_TYPE"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get AWS account info
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✅ AWS Account: $ACCOUNT_ID${NC}"

# Step 1: Create Key Pair if it doesn't exist
echo -e "${BLUE}🔑 Setting up SSH key pair...${NC}"
if aws ec2 describe-key-pairs --key-names $KEY_NAME --region $REGION >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Key pair already exists${NC}"
else
    echo -e "${YELLOW}⚡ Creating SSH key pair...${NC}"
    aws ec2 create-key-pair --key-name $KEY_NAME --region $REGION --query 'KeyMaterial' --output text > ${KEY_NAME}.pem
    chmod 400 ${KEY_NAME}.pem
    echo -e "${GREEN}✅ Key pair created: ${KEY_NAME}.pem${NC}"
fi

# Step 2: Create Security Group
echo -e "${BLUE}🛡️  Setting up security group...${NC}"
SG_NAME="linkhub-saas-sg"
SG_ID=$(aws ec2 describe-security-groups --group-names $SG_NAME --region $REGION --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")

if [ "$SG_ID" = "" ] || [ "$SG_ID" = "None" ]; then
    echo -e "${YELLOW}⚡ Creating security group...${NC}"
    SG_ID=$(aws ec2 create-security-group \
        --group-name $SG_NAME \
        --description "Security group for LinkHub SaaS" \
        --region $REGION \
        --query 'GroupId' --output text)
    
    # Allow HTTP (port 80)
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region $REGION
    
    # Allow HTTPS (port 443)
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 \
        --region $REGION
    
    # Allow SSH (port 22)
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region $REGION
    
    # Allow app port (3000)
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 3000 \
        --cidr 0.0.0.0/0 \
        --region $REGION
    
    echo -e "${GREEN}✅ Security group created: $SG_ID${NC}"
else
    echo -e "${GREEN}✅ Security group already exists: $SG_ID${NC}"
fi

# Step 3: Create User Data Script
echo -e "${BLUE}📝 Creating user data script...${NC}"
cat > user-data.sh << 'EOF'
#!/bin/bash
yum update -y
yum install -y docker

# Start Docker service
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Configure AWS CLI with instance profile (will use IAM role)
# Login to ECR and pull the image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 893519145403.dkr.ecr.us-east-1.amazonaws.com

# Pull and run the LinkHub SaaS container
docker pull 893519145403.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest

# Run the container with restart policy
docker run -d \
    --name linkhub-saas \
    --restart unless-stopped \
    -p 80:3000 \
    -p 3000:3000 \
    -e NODE_ENV=production \
    -e PORT=3000 \
    893519145403.dkr.ecr.us-east-1.amazonaws.com/linkhub-saas:latest

# Create a simple health check script
cat > /home/ec2-user/health-check.sh << 'HEALTH_EOF'
#!/bin/bash
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo "✅ LinkHub SaaS is healthy"
else
    echo "❌ LinkHub SaaS is not responding"
    # Restart container if unhealthy
    docker restart linkhub-saas
fi
HEALTH_EOF

chmod +x /home/ec2-user/health-check.sh

# Add health check to crontab (every 5 minutes)
echo "*/5 * * * * /home/ec2-user/health-check.sh >> /var/log/health-check.log 2>&1" | crontab -u ec2-user -

# Install nginx for better performance (optional)
amazon-linux-extras install nginx1 -y
systemctl start nginx
systemctl enable nginx

# Configure nginx as reverse proxy
cat > /etc/nginx/conf.d/linkhub.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_EOF

# Restart nginx
systemctl restart nginx

# Log deployment completion
echo "$(date): LinkHub SaaS deployment completed" >> /var/log/deployment.log
EOF

# Step 4: Create IAM Role for EC2 (to access ECR)
echo -e "${BLUE}🔐 Setting up IAM role for EC2...${NC}"
ROLE_NAME="EC2-ECR-Access-Role"
INSTANCE_PROFILE_NAME="EC2-ECR-Access-Profile"

# Check if role exists
if aws iam get-role --role-name $ROLE_NAME >/dev/null 2>&1; then
    echo -e "${GREEN}✅ IAM role already exists${NC}"
else
    echo -e "${YELLOW}⚡ Creating IAM role...${NC}"
    
    # Create trust policy
    cat > ec2-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create role
    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file://ec2-trust-policy.json \
        --description "Role for EC2 to access ECR"

    # Attach ECR read policy
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

    # Create instance profile
    aws iam create-instance-profile --instance-profile-name $INSTANCE_PROFILE_NAME

    # Add role to instance profile
    aws iam add-role-to-instance-profile \
        --instance-profile-name $INSTANCE_PROFILE_NAME \
        --role-name $ROLE_NAME

    echo -e "${GREEN}✅ IAM role and instance profile created${NC}"
    rm ec2-trust-policy.json
    
    # Wait for role to propagate
    echo -e "${YELLOW}⏳ Waiting for IAM role to propagate...${NC}"
    sleep 30
fi

# Step 5: Launch EC2 Instance
echo -e "${BLUE}🚀 Launching EC2 instance...${NC}"

# Get the latest Amazon Linux 2 AMI
AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text \
    --region $REGION)

echo "Using AMI: $AMI_ID"

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --count 1 \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $SG_ID \
    --user-data file://user-data.sh \
    --iam-instance-profile Name=$INSTANCE_PROFILE_NAME \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=LinkHub-SaaS},{Key=Application,Value=linkhub-saas}]" \
    --region $REGION \
    --query 'Instances[0].InstanceId' \
    --output text)

echo -e "${GREEN}✅ Instance launched: $INSTANCE_ID${NC}"

# Step 6: Wait for instance to be running
echo -e "${BLUE}⏳ Waiting for instance to be running...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Your LinkHub SaaS is available at:${NC}"
echo -e "${GREEN}   HTTP:  http://$PUBLIC_IP${NC}"
echo -e "${GREEN}   Direct: http://$PUBLIC_IP:3000${NC}"
echo ""
echo -e "${BLUE}📋 Instance Details:${NC}"
echo "   Instance ID: $INSTANCE_ID"
echo "   Public IP: $PUBLIC_IP"
echo "   SSH Access: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
echo ""
echo -e "${BLUE}🏥 Health Check:${NC}"
echo "   curl http://$PUBLIC_IP/health"
echo ""
echo -e "${BLUE}📊 Monitoring:${NC}"
echo "   SSH into instance: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
echo "   Check logs: docker logs linkhub-saas"
echo "   Check status: docker ps"
echo ""
echo -e "${YELLOW}⚠️  Note: It may take 2-3 minutes for the application to fully start${NC}"

# Clean up temporary files
rm -f user-data.sh

echo ""
echo -e "${GREEN}💡 Next steps:${NC}"
echo "1. Test your application: http://$PUBLIC_IP"
echo "2. Set up a domain name (optional)"
echo "3. Configure SSL certificate (optional)"
echo "4. Set up monitoring and backups"
echo ""
echo -e "${BLUE}💰 Cost estimate: ~$8-15/month for t3.micro${NC}"