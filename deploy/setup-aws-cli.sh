#!/bin/bash

# Rita SMS Survey Platform - AWS CLI Setup Script
# This script sets up AWS CLI and verifies the configuration

set -e  # Exit on any error

echo "🚀 Setting up AWS CLI for Rita SMS Survey Platform deployment"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI first:"
    echo "   macOS: brew install awscli"
    echo "   Linux: sudo apt-get install awscli"
    echo "   Windows: Download from https://aws.amazon.com/cli/"
    exit 1
fi

echo "✅ AWS CLI found: $(aws --version)"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "⚠️  AWS CLI not configured. Please run 'aws configure' first"
    echo "   You'll need your Access Key ID, Secret Access Key, and preferred region"
    exit 1
fi

echo "✅ AWS CLI is configured"

# Get current AWS identity
echo "📋 Current AWS Identity:"
aws sts get-caller-identity

# Set default region if not set
AWS_REGION=${AWS_REGION:-us-east-1}
echo "🌍 Using AWS region: $AWS_REGION"

# Export region for subsequent scripts
export AWS_DEFAULT_REGION=$AWS_REGION

# Check required permissions by testing basic operations
echo "🔐 Checking AWS permissions..."

# Test S3 access
if aws s3 ls &> /dev/null; then
    echo "✅ S3 access confirmed"
else
    echo "⚠️  S3 access limited or denied"
fi

# Test ECR access
if aws ecr describe-repositories --region $AWS_REGION &> /dev/null; then
    echo "✅ ECR access confirmed"
else
    echo "⚠️  ECR access limited or denied"
fi

# Test ECS access
if aws ecs list-clusters --region $AWS_REGION &> /dev/null; then
    echo "✅ ECS access confirmed"
else
    echo "⚠️  ECS access limited or denied"
fi

echo "🎯 AWS CLI setup complete!"
echo "📝 Next steps:"
echo "   1. Set environment variables in .env.production"
echo "   2. Run infrastructure setup scripts"
echo "   3. Deploy the application"