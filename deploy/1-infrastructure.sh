#!/bin/bash

# Rita SMS Survey Platform - Infrastructure Setup Script
# Creates VPC, subnets, security groups, and basic AWS infrastructure

set -e

# Configuration
PROJECT_NAME="rita-sms-survey"
AWS_REGION=${AWS_REGION:-us-east-1}
ENVIRONMENT=${ENVIRONMENT:-production}

echo "🏗️  Setting up AWS infrastructure for Rita SMS Survey Platform"
echo "📍 Region: $AWS_REGION"
echo "🏷️  Environment: $ENVIRONMENT"

# Check for existing VPC first
echo "🔍 Checking for existing VPC..."
EXISTING_VPC=$(aws ec2 describe-vpcs \
    --region $AWS_REGION \
    --filters "Name=tag:Name,Values=$PROJECT_NAME-vpc" "Name=state,Values=available" \
    --query 'Vpcs[0].VpcId' \
    --output text 2>/dev/null || echo "None")

if [ "$EXISTING_VPC" != "None" ] && [ "$EXISTING_VPC" != "" ]; then
    echo "✅ Found existing VPC: $EXISTING_VPC"
    VPC_ID=$EXISTING_VPC
else
    echo "🌐 Creating new VPC..."
    VPC_ID=$(aws ec2 create-vpc \
        --cidr-block 10.0.0.0/16 \
        --query 'Vpc.VpcId' \
        --output text \
        --region $AWS_REGION)

    aws ec2 create-tags \
        --resources $VPC_ID \
        --tags Key=Name,Value="$PROJECT_NAME-vpc" \
        --region $AWS_REGION

    echo "✅ VPC created: $VPC_ID"
fi

# Enable DNS hostnames and resolution
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames --region $AWS_REGION
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support --region $AWS_REGION

# Create Internet Gateway
echo "🌍 Creating Internet Gateway..."
IGW_ID=$(aws ec2 create-internet-gateway \
    --query 'InternetGateway.InternetGatewayId' \
    --output text \
    --region $AWS_REGION)

aws ec2 create-tags \
    --resources $IGW_ID \
    --tags Key=Name,Value="$PROJECT_NAME-igw" \
    --region $AWS_REGION

aws ec2 attach-internet-gateway \
    --internet-gateway-id $IGW_ID \
    --vpc-id $VPC_ID \
    --region $AWS_REGION

echo "✅ Internet Gateway created: $IGW_ID"

# Get availability zones
AZ1=$(aws ec2 describe-availability-zones --region $AWS_REGION --query 'AvailabilityZones[0].ZoneName' --output text)
AZ2=$(aws ec2 describe-availability-zones --region $AWS_REGION --query 'AvailabilityZones[1].ZoneName' --output text)

# Create Public Subnets
echo "🏢 Creating public subnets..."
PUBLIC_SUBNET_1_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.1.0/24 \
    --availability-zone $AZ1 \
    --query 'Subnet.SubnetId' \
    --output text \
    --region $AWS_REGION)

aws ec2 create-tags \
    --resources $PUBLIC_SUBNET_1_ID \
    --tags Key=Name,Value="$PROJECT_NAME-public-1" \
    --region $AWS_REGION

PUBLIC_SUBNET_2_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.2.0/24 \
    --availability-zone $AZ2 \
    --query 'Subnet.SubnetId' \
    --output text \
    --region $AWS_REGION)

aws ec2 create-tags \
    --resources $PUBLIC_SUBNET_2_ID \
    --tags Key=Name,Value="$PROJECT_NAME-public-2" \
    --region $AWS_REGION

# Create Private Subnets
echo "🔒 Creating private subnets..."
PRIVATE_SUBNET_1_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.3.0/24 \
    --availability-zone $AZ1 \
    --query 'Subnet.SubnetId' \
    --output text \
    --region $AWS_REGION)

aws ec2 create-tags \
    --resources $PRIVATE_SUBNET_1_ID \
    --tags Key=Name,Value="$PROJECT_NAME-private-1" \
    --region $AWS_REGION

PRIVATE_SUBNET_2_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block 10.0.4.0/24 \
    --availability-zone $AZ2 \
    --query 'Subnet.SubnetId' \
    --output text \
    --region $AWS_REGION)

aws ec2 create-tags \
    --resources $PRIVATE_SUBNET_2_ID \
    --tags Key=Name,Value="$PROJECT_NAME-private-2" \
    --region $AWS_REGION

echo "✅ Subnets created"

# Create Route Table for public subnets
echo "🛣️  Creating route tables..."
PUBLIC_RT_ID=$(aws ec2 create-route-table \
    --vpc-id $VPC_ID \
    --query 'RouteTable.RouteTableId' \
    --output text \
    --region $AWS_REGION)

aws ec2 create-tags \
    --resources $PUBLIC_RT_ID \
    --tags Key=Name,Value="$PROJECT_NAME-public-rt" \
    --region $AWS_REGION

# Add route to Internet Gateway
aws ec2 create-route \
    --route-table-id $PUBLIC_RT_ID \
    --destination-cidr-block 0.0.0.0/0 \
    --gateway-id $IGW_ID \
    --region $AWS_REGION

# Associate public subnets with public route table
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1_ID --route-table-id $PUBLIC_RT_ID --region $AWS_REGION
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2_ID --route-table-id $PUBLIC_RT_ID --region $AWS_REGION

# Create Security Group for ALB
echo "🔐 Creating security groups..."
ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name "$PROJECT_NAME-alb-sg" \
    --description "Security group for Rita ALB" \
    --vpc-id $VPC_ID \
    --query 'GroupId' \
    --output text \
    --region $AWS_REGION)

# Allow HTTP and HTTPS traffic to ALB
aws ec2 authorize-security-group-ingress \
    --group-id $ALB_SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

aws ec2 authorize-security-group-ingress \
    --group-id $ALB_SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region $AWS_REGION

# Create Security Group for ECS tasks
ECS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$PROJECT_NAME-ecs-sg" \
    --description "Security group for Rita ECS tasks" \
    --vpc-id $VPC_ID \
    --query 'GroupId' \
    --output text \
    --region $AWS_REGION)

# Allow traffic from ALB to ECS
aws ec2 authorize-security-group-ingress \
    --group-id $ECS_SG_ID \
    --protocol tcp \
    --port 3000 \
    --source-group $ALB_SG_ID \
    --region $AWS_REGION

# Create Security Group for DocumentDB
DB_SG_ID=$(aws ec2 create-security-group \
    --group-name "$PROJECT_NAME-db-sg" \
    --description "Security group for Rita DocumentDB" \
    --vpc-id $VPC_ID \
    --query 'GroupId' \
    --output text \
    --region $AWS_REGION)

# Allow MongoDB traffic from ECS to DocumentDB
aws ec2 authorize-security-group-ingress \
    --group-id $DB_SG_ID \
    --protocol tcp \
    --port 27017 \
    --source-group $ECS_SG_ID \
    --region $AWS_REGION

echo "✅ Security groups created"

# Create S3 buckets
echo "📦 Creating S3 buckets..."

# Static files bucket
S3_STATIC_BUCKET="$PROJECT_NAME-static-$ENVIRONMENT"
aws s3 mb s3://$S3_STATIC_BUCKET --region $AWS_REGION || echo "Bucket may already exist"

# Uploads bucket
S3_UPLOADS_BUCKET="$PROJECT_NAME-uploads-$ENVIRONMENT"
aws s3 mb s3://$S3_UPLOADS_BUCKET --region $AWS_REGION || echo "Bucket may already exist"

echo "✅ S3 buckets created"

# Save configuration to file
cat > deploy/aws-config.env << EOF
# AWS Infrastructure Configuration
VPC_ID=$VPC_ID
IGW_ID=$IGW_ID
PUBLIC_SUBNET_1_ID=$PUBLIC_SUBNET_1_ID
PUBLIC_SUBNET_2_ID=$PUBLIC_SUBNET_2_ID
PRIVATE_SUBNET_1_ID=$PRIVATE_SUBNET_1_ID
PRIVATE_SUBNET_2_ID=$PRIVATE_SUBNET_2_ID
ALB_SG_ID=$ALB_SG_ID
ECS_SG_ID=$ECS_SG_ID
DB_SG_ID=$DB_SG_ID
S3_STATIC_BUCKET=$S3_STATIC_BUCKET
S3_UPLOADS_BUCKET=$S3_UPLOADS_BUCKET
AWS_REGION=$AWS_REGION
EOF

echo "📝 Configuration saved to deploy/aws-config.env"
echo "🎉 Infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "1. Run ./deploy/2-database.sh to set up DocumentDB"
echo "2. Run ./deploy/3-backend.sh to deploy the API"
echo "3. Run ./deploy/4-frontend.sh to deploy the React app"