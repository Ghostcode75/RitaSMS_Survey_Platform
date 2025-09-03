#!/bin/bash

# Rita SMS Survey Platform - Complete Deployment Script
# Runs all deployment scripts in sequence

set -e

echo "🚀 Starting complete deployment of Rita SMS Survey Platform to AWS"
echo "⚠️  This will create AWS resources that may incur charges"
echo ""

# Prompt for confirmation
read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI first"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first"
    exit 1
fi

echo "✅ All prerequisites met"

# Set environment variables
export AWS_REGION=${AWS_REGION:-us-east-1}
export ENVIRONMENT=${ENVIRONMENT:-production}

echo "🌍 Deploying to region: $AWS_REGION"
echo "🏷️  Environment: $ENVIRONMENT"

# Step 1: Infrastructure
echo ""
echo "📍 Step 1/4: Setting up infrastructure..."
./deploy/1-infrastructure.sh

# Step 2: Database
echo ""
echo "📍 Step 2/4: Setting up database..."
./deploy/2-database.sh

# Step 3: Backend
echo ""
echo "📍 Step 3/4: Deploying backend..."
./deploy/3-backend.sh

# Step 4: Frontend
echo ""
echo "📍 Step 4/4: Deploying frontend..."
./deploy/4-frontend.sh

echo ""
echo "🎉 Complete deployment successful!"
echo ""
echo "📋 Next Steps:"
echo "1. Configure your Twilio webhook URL"
echo "2. Set up your domain name (optional)"
echo "3. Test your application"
echo ""
echo "📄 See deploy/deployment-summary.md for full details"