#!/bin/bash

# Rita SMS Survey Platform - Backend Deployment Script
# Builds and deploys the Node.js API to AWS ECS Fargate

set -e

# Load configuration
if [ -f "deploy/aws-config.env" ]; then
    source deploy/aws-config.env
else
    echo "❌ aws-config.env not found. Please run previous setup scripts first"
    exit 1
fi

PROJECT_NAME="rita-sms-survey"
ENVIRONMENT=${ENVIRONMENT:-production}

echo "🚀 Deploying Rita SMS Survey Platform Backend"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# ECR Repository name
ECR_REPO_NAME="$PROJECT_NAME-api"
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"

# Create ECR repository
echo "📦 Creating ECR repository..."
aws ecr create-repository \
    --repository-name $ECR_REPO_NAME \
    --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true || echo "Repository may already exist"

# Get ECR login token
echo "🔐 Authenticating Docker with ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t $ECR_REPO_NAME:latest .

# Tag and push image to ECR
echo "📤 Pushing image to ECR..."
docker tag $ECR_REPO_NAME:latest $ECR_URI:latest
docker tag $ECR_REPO_NAME:latest $ECR_URI:$(date +%Y%m%d-%H%M%S)
docker push $ECR_URI:latest
docker push $ECR_URI:$(date +%Y%m%d-%H%M%S)

# Create ECS cluster
echo "🏗️  Creating ECS cluster..."
aws ecs create-cluster \
    --cluster-name "$PROJECT_NAME-cluster" \
    --capacity-providers FARGATE \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
    --region $AWS_REGION || echo "Cluster may already exist"

# Create CloudWatch log group
echo "📊 Creating CloudWatch log group..."
aws logs create-log-group \
    --log-group-name "/ecs/$PROJECT_NAME-api" \
    --region $AWS_REGION || echo "Log group may already exist"

# Create IAM role for ECS task execution
echo "🔑 Creating ECS task execution role..."
TASK_EXECUTION_ROLE_NAME="$PROJECT_NAME-ecs-execution-role"

# Create trust policy
cat > /tmp/ecs-trust-policy.json << EOF
{
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
}
EOF

# Create the role
aws iam create-role \
    --role-name $TASK_EXECUTION_ROLE_NAME \
    --assume-role-policy-document file:///tmp/ecs-trust-policy.json || echo "Role may already exist"

# Attach the required policies
aws iam attach-role-policy \
    --role-name $TASK_EXECUTION_ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

aws iam attach-role-policy \
    --role-name $TASK_EXECUTION_ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

# Get role ARN
EXECUTION_ROLE_ARN=$(aws iam get-role --role-name $TASK_EXECUTION_ROLE_NAME --query 'Role.Arn' --output text)

# Create IAM role for ECS task
TASK_ROLE_NAME="$PROJECT_NAME-ecs-task-role"

aws iam create-role \
    --role-name $TASK_ROLE_NAME \
    --assume-role-policy-document file:///tmp/ecs-trust-policy.json || echo "Role may already exist"

# Create policy for S3 access
cat > /tmp/s3-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::$S3_UPLOADS_BUCKET/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::$S3_UPLOADS_BUCKET"
      ]
    }
  ]
}
EOF

aws iam create-policy \
    --policy-name "$PROJECT_NAME-s3-policy" \
    --policy-document file:///tmp/s3-policy.json || echo "Policy may already exist"

aws iam attach-role-policy \
    --role-name $TASK_ROLE_NAME \
    --policy-arn "arn:aws:iam::$AWS_ACCOUNT_ID:policy/$PROJECT_NAME-s3-policy"

TASK_ROLE_ARN=$(aws iam get-role --role-name $TASK_ROLE_NAME --query 'Role.Arn' --output text)

# Create ECS task definition
echo "📋 Creating ECS task definition..."
cat > /tmp/task-definition.json << EOF
{
  "family": "$PROJECT_NAME-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "$EXECUTION_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "$PROJECT_NAME-api",
      "image": "$ECR_URI:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "AWS_REGION",
          "value": "$AWS_REGION"
        },
        {
          "name": "S3_BUCKET_NAME",
          "value": "$S3_UPLOADS_BUCKET"
        }
      ],
      "secrets": [
        {
          "name": "MONGODB_URI",
          "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:$SECRETS_NAME"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$PROJECT_NAME-api",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

aws ecs register-task-definition \
    --cli-input-json file:///tmp/task-definition.json \
    --region $AWS_REGION

# Create Application Load Balancer
echo "⚖️  Creating Application Load Balancer..."
ALB_NAME="$PROJECT_NAME-alb"

ALB_ARN=$(aws elbv2 create-load-balancer \
    --name $ALB_NAME \
    --subnets $PUBLIC_SUBNET_1_ID $PUBLIC_SUBNET_2_ID \
    --security-groups $ALB_SG_ID \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text) || echo "ALB may already exist"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query 'LoadBalancers[0].DNSName' \
    --output text \
    --region $AWS_REGION)

# Create target group
echo "🎯 Creating target group..."
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
    --name "$PROJECT_NAME-tg" \
    --protocol HTTP \
    --port 3000 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path /api/health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --region $AWS_REGION \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text) || echo "Target group may already exist"

# Create ALB listener
echo "👂 Creating ALB listener..."
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
    --region $AWS_REGION || echo "Listener may already exist"

# Create ECS service
echo "🌐 Creating ECS service..."
cat > /tmp/service-definition.json << EOF
{
  "serviceName": "$PROJECT_NAME-api-service",
  "cluster": "$PROJECT_NAME-cluster",
  "taskDefinition": "$PROJECT_NAME-api",
  "desiredCount": 2,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["$PRIVATE_SUBNET_1_ID", "$PRIVATE_SUBNET_2_ID"],
      "securityGroups": ["$ECS_SG_ID"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "$TARGET_GROUP_ARN",
      "containerName": "$PROJECT_NAME-api",
      "containerPort": 3000
    }
  ],
  "healthCheckGracePeriodSeconds": 300,
  "enableExecuteCommand": true
}
EOF

aws ecs create-service \
    --cli-input-json file:///tmp/service-definition.json \
    --region $AWS_REGION || echo "Service may already exist"

# Clean up temporary files
rm -f /tmp/ecs-trust-policy.json /tmp/s3-policy.json /tmp/task-definition.json /tmp/service-definition.json

# Update configuration file
cat >> deploy/aws-config.env << EOF

# Backend Configuration
ECR_URI=$ECR_URI
ALB_ARN=$ALB_ARN
ALB_DNS=$ALB_DNS
TARGET_GROUP_ARN=$TARGET_GROUP_ARN
EXECUTION_ROLE_ARN=$EXECUTION_ROLE_ARN
TASK_ROLE_ARN=$TASK_ROLE_ARN
EOF

echo "✅ Backend deployment complete!"
echo ""
echo "📋 Deployment Details:"
echo "   Load Balancer: $ALB_DNS"
echo "   API Endpoint: http://$ALB_DNS/api"
echo "   Health Check: http://$ALB_DNS/api/health"
echo ""
echo "⏳ Services are starting up. This may take a few minutes."
echo "Next step: Run ./deploy/4-frontend.sh to deploy the React app"