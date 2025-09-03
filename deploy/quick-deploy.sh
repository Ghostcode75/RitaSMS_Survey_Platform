#!/bin/bash

# Rita SMS Survey Platform - Quick Deployment Script
# Deploys to default VPC to avoid subnet conflicts

set -e

PROJECT_NAME="rita-sms-survey"
AWS_REGION=${AWS_REGION:-us-east-1}
ENVIRONMENT=${ENVIRONMENT:-production}

echo "🚀 Quick deployment of Rita SMS Survey Platform"
echo "📍 Region: $AWS_REGION"

# Use default VPC
DEFAULT_VPC=$(aws ec2 describe-vpcs \
    --region $AWS_REGION \
    --filters "Name=is-default,Values=true" \
    --query 'Vpcs[0].VpcId' \
    --output text)

echo "🌐 Using default VPC: $DEFAULT_VPC"

# Get default subnets
SUBNETS=$(aws ec2 describe-subnets \
    --region $AWS_REGION \
    --filters "Name=vpc-id,Values=$DEFAULT_VPC" \
    --query 'Subnets[*].SubnetId' \
    --output text)

SUBNET_LIST=$(echo $SUBNETS | tr ' ' ',')
echo "🏢 Using subnets: $SUBNET_LIST"

# Create security group for ALB
echo "🔒 Creating ALB security group..."
ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name "$PROJECT_NAME-alb-sg-$(date +%s)" \
    --description "ALB security group for Rita SMS Survey Platform" \
    --vpc-id $DEFAULT_VPC \
    --region $AWS_REGION \
    --query 'GroupId' \
    --output text)

# Allow HTTP/HTTPS traffic to ALB
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

echo "✅ ALB Security Group created: $ALB_SG_ID"

# Create security group for ECS tasks
echo "🔒 Creating ECS security group..."
ECS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$PROJECT_NAME-ecs-sg-$(date +%s)" \
    --description "ECS security group for Rita SMS Survey Platform" \
    --vpc-id $DEFAULT_VPC \
    --region $AWS_REGION \
    --query 'GroupId' \
    --output text)

# Allow traffic from ALB to ECS
aws ec2 authorize-security-group-ingress \
    --group-id $ECS_SG_ID \
    --protocol tcp \
    --port 3000 \
    --source-group $ALB_SG_ID \
    --region $AWS_REGION

echo "✅ ECS Security Group created: $ECS_SG_ID"

# Create ECR repository
echo "📦 Creating ECR repository..."
aws ecr create-repository \
    --repository-name "$PROJECT_NAME" \
    --region $AWS_REGION || echo "Repository may already exist"

# Get ECR URI
ECR_URI=$(aws ecr describe-repositories \
    --repository-names "$PROJECT_NAME" \
    --region $AWS_REGION \
    --query 'repositories[0].repositoryUri' \
    --output text)

echo "📦 ECR Repository: $ECR_URI"

# Build and push Docker image
echo "🐳 Building Docker image..."
docker build -t $PROJECT_NAME .

echo "🔑 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

echo "🏷️ Tagging and pushing image..."
docker tag $PROJECT_NAME:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Create ECS cluster
echo "🎯 Creating ECS cluster..."
aws ecs create-cluster \
    --cluster-name "$PROJECT_NAME-cluster" \
    --region $AWS_REGION || echo "Cluster may already exist"

# Create execution role if it doesn't exist
echo "🔐 Creating ECS execution role..."
aws iam create-role \
    --role-name "${PROJECT_NAME}-execution-role" \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "ecs-tasks.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' || echo "Role may already exist"

aws iam attach-role-policy \
    --role-name "${PROJECT_NAME}-execution-role" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"

# Create Application Load Balancer
echo "⚖️ Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "$PROJECT_NAME-alb" \
    --subnets $SUBNETS \
    --security-groups $ALB_SG_ID \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].DNSName' \
    --output text)

echo "✅ ALB created: $ALB_DNS"

# Create target group
echo "🎯 Creating target group..."
TG_ARN=$(aws elbv2 create-target-group \
    --name "$PROJECT_NAME-tg" \
    --protocol HTTP \
    --port 3000 \
    --vpc-id $DEFAULT_VPC \
    --health-check-path "/api/health" \
    --region $AWS_REGION \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

# Create listener
echo "👂 Creating ALB listener..."
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TG_ARN \
    --region $AWS_REGION

# Create task definition
echo "📋 Creating ECS task definition..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
EXECUTION_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${PROJECT_NAME}-execution-role"

cat > task-definition.json << EOF
{
    "family": "$PROJECT_NAME",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "512",
    "memory": "1024",
    "executionRoleArn": "$EXECUTION_ROLE_ARN",
    "containerDefinitions": [
        {
            "name": "$PROJECT_NAME",
            "image": "$ECR_URI:latest",
            "portMappings": [
                {
                    "containerPort": 3000,
                    "protocol": "tcp"
                }
            ],
            "essential": true,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/$PROJECT_NAME",
                    "awslogs-region": "$AWS_REGION",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "environment": [
                {"name": "NODE_ENV", "value": "production"},
                {"name": "PORT", "value": "3000"},
                {"name": "TWILIO_ACCOUNT_SID", "value": "AC7122858476ff6ef60f5ada56e217cfd6"},
                {"name": "TWILIO_AUTH_TOKEN", "value": "061cd8a602a5d24a0fb4d51ac902f25e"},
                {"name": "TWILIO_PHONE_NUMBER", "value": "+17754297312"}
            ]
        }
    ]
}
EOF

# Create CloudWatch log group
aws logs create-log-group \
    --log-group-name "/ecs/$PROJECT_NAME" \
    --region $AWS_REGION || echo "Log group may already exist"

# Register task definition
aws ecs register-task-definition \
    --cli-input-json file://task-definition.json \
    --region $AWS_REGION

# Create ECS service
echo "🚀 Creating ECS service..."
aws ecs create-service \
    --cluster "$PROJECT_NAME-cluster" \
    --service-name "$PROJECT_NAME-service" \
    --task-definition "$PROJECT_NAME" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$TG_ARN,containerName=$PROJECT_NAME,containerPort=3000" \
    --region $AWS_REGION

echo ""
echo "🎉 Quick deployment complete!"
echo ""
echo "🌍 Your application will be available at: http://$ALB_DNS"
echo "⏱️  It may take 2-3 minutes for the service to start"
echo ""
echo "🔍 Check service status:"
echo "aws ecs describe-services --cluster $PROJECT_NAME-cluster --services $PROJECT_NAME-service --region $AWS_REGION"
echo ""
echo "📋 Clean up task definition file"
rm -f task-definition.json