#!/bin/bash

# Rita SMS Survey Platform - Cleanup Script
# Removes all AWS resources created by the deployment scripts

set -e

# Load configuration
if [ -f "deploy/aws-config.env" ]; then
    source deploy/aws-config.env
else
    echo "❌ aws-config.env not found. Nothing to clean up."
    exit 1
fi

PROJECT_NAME="rita-sms-survey"

echo "🧹 Cleaning up Rita SMS Survey Platform AWS resources"
echo "⚠️  This will permanently delete all deployed resources"
echo ""

# Prompt for confirmation
read -p "Are you sure you want to delete ALL resources? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

echo "🗑️  Starting cleanup process..."

# Delete CloudFront distribution
if [ ! -z "$CLOUDFRONT_ID" ]; then
    echo "☁️  Disabling CloudFront distribution..."
    aws cloudfront get-distribution-config --id $CLOUDFRONT_ID --query 'DistributionConfig' > /tmp/cf-config.json
    
    # Disable the distribution first
    jq '.Enabled = false' /tmp/cf-config.json > /tmp/cf-config-disabled.json
    
    ETAG=$(aws cloudfront get-distribution-config --id $CLOUDFRONT_ID --query 'ETag' --output text)
    
    aws cloudfront update-distribution \
        --id $CLOUDFRONT_ID \
        --distribution-config file:///tmp/cf-config-disabled.json \
        --if-match $ETAG || echo "Distribution may not exist"
    
    echo "⏳ Waiting for distribution to be disabled..."
    aws cloudfront wait distribution-deployed --id $CLOUDFRONT_ID || echo "Distribution may not exist"
    
    echo "🗑️  Deleting CloudFront distribution..."
    ETAG=$(aws cloudfront get-distribution-config --id $CLOUDFRONT_ID --query 'ETag' --output text)
    aws cloudfront delete-distribution --id $CLOUDFRONT_ID --if-match $ETAG || echo "Distribution may not exist"
fi

# Delete ECS service and cluster
echo "🏗️  Deleting ECS service and cluster..."
aws ecs update-service \
    --cluster "$PROJECT_NAME-cluster" \
    --service "$PROJECT_NAME-api-service" \
    --desired-count 0 \
    --region $AWS_REGION || echo "Service may not exist"

echo "⏳ Waiting for service to scale down..."
aws ecs wait services-stable \
    --cluster "$PROJECT_NAME-cluster" \
    --services "$PROJECT_NAME-api-service" \
    --region $AWS_REGION || echo "Service may not exist"

aws ecs delete-service \
    --cluster "$PROJECT_NAME-cluster" \
    --service "$PROJECT_NAME-api-service" \
    --region $AWS_REGION || echo "Service may not exist"

aws ecs delete-cluster \
    --cluster "$PROJECT_NAME-cluster" \
    --region $AWS_REGION || echo "Cluster may not exist"

# Delete ALB and target group
echo "⚖️  Deleting load balancer..."
if [ ! -z "$ALB_ARN" ]; then
    aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN --region $AWS_REGION || echo "ALB may not exist"
fi

if [ ! -z "$TARGET_GROUP_ARN" ]; then
    aws elbv2 delete-target-group --target-group-arn $TARGET_GROUP_ARN --region $AWS_REGION || echo "Target group may not exist"
fi

# Delete DocumentDB cluster and instance
echo "🗄️  Deleting DocumentDB cluster..."
aws docdb delete-db-instance \
    --db-instance-identifier "$DOCDB_CLUSTER_ID-instance-1" \
    --region $AWS_REGION || echo "DocumentDB instance may not exist"

aws docdb delete-db-cluster \
    --db-cluster-identifier $DOCDB_CLUSTER_ID \
    --skip-final-snapshot \
    --region $AWS_REGION || echo "DocumentDB cluster may not exist"

aws docdb delete-db-subnet-group \
    --db-subnet-group-name "$PROJECT_NAME-docdb-subnet-group" \
    --region $AWS_REGION || echo "Subnet group may not exist"

aws docdb delete-db-cluster-parameter-group \
    --db-cluster-parameter-group-name "$PROJECT_NAME-docdb-params" \
    --region $AWS_REGION || echo "Parameter group may not exist"

# Delete ECR repository
echo "📦 Deleting ECR repository..."
aws ecr delete-repository \
    --repository-name "$PROJECT_NAME-api" \
    --force \
    --region $AWS_REGION || echo "ECR repository may not exist"

# Delete S3 buckets
echo "📦 Deleting S3 buckets..."
if [ ! -z "$S3_STATIC_BUCKET" ]; then
    aws s3 rm s3://$S3_STATIC_BUCKET --recursive || echo "Static bucket may not exist"
    aws s3 rb s3://$S3_STATIC_BUCKET || echo "Static bucket may not exist"
fi

if [ ! -z "$S3_UPLOADS_BUCKET" ]; then
    aws s3 rm s3://$S3_UPLOADS_BUCKET --recursive || echo "Uploads bucket may not exist"
    aws s3 rb s3://$S3_UPLOADS_BUCKET || echo "Uploads bucket may not exist"
fi

# Delete IAM roles and policies
echo "🔑 Deleting IAM roles and policies..."
aws iam detach-role-policy \
    --role-name "$PROJECT_NAME-ecs-execution-role" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy || echo "Policy may not be attached"

aws iam detach-role-policy \
    --role-name "$PROJECT_NAME-ecs-execution-role" \
    --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite || echo "Policy may not be attached"

aws iam delete-role \
    --role-name "$PROJECT_NAME-ecs-execution-role" || echo "Execution role may not exist"

aws iam detach-role-policy \
    --role-name "$PROJECT_NAME-ecs-task-role" \
    --policy-arn "arn:aws:iam::$AWS_ACCOUNT_ID:policy/$PROJECT_NAME-s3-policy" || echo "S3 policy may not be attached"

aws iam delete-role \
    --role-name "$PROJECT_NAME-ecs-task-role" || echo "Task role may not exist"

aws iam delete-policy \
    --policy-arn "arn:aws:iam::$AWS_ACCOUNT_ID:policy/$PROJECT_NAME-s3-policy" || echo "S3 policy may not exist"

# Delete Secrets Manager secret
echo "🔐 Deleting secrets..."
aws secretsmanager delete-secret \
    --secret-id "$PROJECT_NAME/database" \
    --force-delete-without-recovery \
    --region $AWS_REGION || echo "Secret may not exist"

# Delete CloudWatch log group
echo "📊 Deleting CloudWatch log group..."
aws logs delete-log-group \
    --log-group-name "/ecs/$PROJECT_NAME-api" \
    --region $AWS_REGION || echo "Log group may not exist"

# Wait a bit before deleting security groups and VPC resources
echo "⏳ Waiting for resources to be fully deleted..."
sleep 30

# Delete security groups
echo "🔒 Deleting security groups..."
aws ec2 delete-security-group --group-id $DB_SG_ID --region $AWS_REGION || echo "DB security group may not exist"
aws ec2 delete-security-group --group-id $ECS_SG_ID --region $AWS_REGION || echo "ECS security group may not exist"
aws ec2 delete-security-group --group-id $ALB_SG_ID --region $AWS_REGION || echo "ALB security group may not exist"

# Delete subnets
echo "🏢 Deleting subnets..."
aws ec2 delete-subnet --subnet-id $PRIVATE_SUBNET_2_ID --region $AWS_REGION || echo "Private subnet 2 may not exist"
aws ec2 delete-subnet --subnet-id $PRIVATE_SUBNET_1_ID --region $AWS_REGION || echo "Private subnet 1 may not exist"
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_2_ID --region $AWS_REGION || echo "Public subnet 2 may not exist"
aws ec2 delete-subnet --subnet-id $PUBLIC_SUBNET_1_ID --region $AWS_REGION || echo "Public subnet 1 may not exist"

# Delete route table
echo "🛣️  Deleting route tables..."
aws ec2 delete-route-table --route-table-id $PUBLIC_RT_ID --region $AWS_REGION || echo "Route table may not exist"

# Detach and delete internet gateway
echo "🌍 Deleting internet gateway..."
aws ec2 detach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID --region $AWS_REGION || echo "IGW may not be attached"
aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID --region $AWS_REGION || echo "IGW may not exist"

# Delete VPC
echo "🌐 Deleting VPC..."
aws ec2 delete-vpc --vpc-id $VPC_ID --region $AWS_REGION || echo "VPC may not exist"

# Clean up temporary files
rm -f /tmp/cf-config.json /tmp/cf-config-disabled.json

echo "✅ Cleanup complete!"
echo ""
echo "🗑️  All Rita SMS Survey Platform resources have been deleted from AWS"
echo "💰 This should stop all associated AWS charges"