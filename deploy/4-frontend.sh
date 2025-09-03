#!/bin/bash

# Rita SMS Survey Platform - Frontend Deployment Script
# Builds and deploys the React app to S3 with CloudFront CDN

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

echo "🎨 Deploying Rita SMS Survey Platform Frontend"

# Check if we have ALB DNS for API endpoint
if [ -z "$ALB_DNS" ]; then
    echo "❌ ALB_DNS not found. Please run 3-backend.sh first"
    exit 1
fi

# Build the React application
echo "🔨 Building React application..."
npm run build

# Create API configuration for frontend
mkdir -p dist/config
cat > dist/config/api-config.js << EOF
window.API_CONFIG = {
  baseURL: 'http://$ALB_DNS',
  apiPath: '/api',
  environment: '$ENVIRONMENT'
};
EOF

# Update index.html to include API config
sed -i.bak 's|<head>|<head>\n  <script src="/config/api-config.js"></script>|' dist/index.html

# Configure S3 bucket for static website hosting
echo "🌐 Configuring S3 bucket for web hosting..."
aws s3api put-bucket-website \
    --bucket $S3_STATIC_BUCKET \
    --website-configuration '{
      "IndexDocument": {"Suffix": "index.html"},
      "ErrorDocument": {"Key": "index.html"}
    }' \
    --region $AWS_REGION

# Create bucket policy for public read access
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$S3_STATIC_BUCKET/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
    --bucket $S3_STATIC_BUCKET \
    --policy file:///tmp/bucket-policy.json

# Upload built files to S3
echo "📤 Uploading files to S3..."
aws s3 sync dist/ s3://$S3_STATIC_BUCKET/ \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "*.html" \
    --region $AWS_REGION

# Upload HTML files with different cache settings
aws s3 sync dist/ s3://$S3_STATIC_BUCKET/ \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --region $AWS_REGION

# Create CloudFront distribution
echo "☁️  Creating CloudFront distribution..."

# Generate a unique caller reference
CALLER_REF="$PROJECT_NAME-$(date +%Y%m%d-%H%M%S)"

cat > /tmp/cloudfront-config.json << EOF
{
  "CallerReference": "$CALLER_REF",
  "Comment": "CloudFront distribution for Rita SMS Survey Platform",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "S3-$S3_STATIC_BUCKET",
        "DomainName": "$S3_STATIC_BUCKET.s3-website-$AWS_REGION.amazonaws.com",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      },
      {
        "Id": "ALB-API",
        "DomainName": "$ALB_DNS",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$S3_STATIC_BUCKET",
    "ViewerProtocolPolicy": "redirect-to-https",
    "MinTTL": 0,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    },
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "Compress": true
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "ALB-API",
        "ViewerProtocolPolicy": "https-only",
        "MinTTL": 0,
        "ForwardedValues": {
          "QueryString": true,
          "Cookies": {"Forward": "all"},
          "Headers": {
            "Quantity": 4,
            "Items": ["Authorization", "Content-Type", "Accept", "Origin"]
          }
        },
        "TrustedSigners": {
          "Enabled": false,
          "Quantity": 0
        },
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
          "CachedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"]
          }
        },
        "Compress": false
      }
    ]
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

# Create CloudFront distribution
CLOUDFRONT_ID=$(aws cloudfront create-distribution \
    --distribution-config file:///tmp/cloudfront-config.json \
    --query 'Distribution.Id' \
    --output text)

# Get CloudFront domain name
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
    --id $CLOUDFRONT_ID \
    --query 'Distribution.DomainName' \
    --output text)

echo "⏳ CloudFront distribution is being created. This may take 10-15 minutes..."

# Clean up temporary files
rm -f /tmp/bucket-policy.json /tmp/cloudfront-config.json

# Update configuration file
cat >> deploy/aws-config.env << EOF

# Frontend Configuration
CLOUDFRONT_ID=$CLOUDFRONT_ID
CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN
WEBSITE_URL=https://$CLOUDFRONT_DOMAIN
EOF

# Create deployment summary
cat > deploy/deployment-summary.md << EOF
# Rita SMS Survey Platform - Deployment Summary

## 🚀 Deployment Complete!

### Frontend
- **S3 Bucket**: $S3_STATIC_BUCKET
- **CloudFront Distribution**: $CLOUDFRONT_ID
- **Website URL**: https://$CLOUDFRONT_DOMAIN

### Backend
- **Load Balancer**: $ALB_DNS
- **API Endpoint**: http://$ALB_DNS/api
- **ECS Cluster**: $PROJECT_NAME-cluster
- **ECR Repository**: $ECR_URI

### Database
- **DocumentDB Cluster**: $DOCDB_CLUSTER_ID
- **Endpoint**: $DOCDB_ENDPOINT
- **Credentials**: Stored in AWS Secrets Manager

### Infrastructure
- **VPC**: $VPC_ID
- **Region**: $AWS_REGION
- **Environment**: $ENVIRONMENT

## Access Your Application
1. **Website**: https://$CLOUDFRONT_DOMAIN
2. **API Health Check**: http://$ALB_DNS/api/health
3. **Admin Panel**: https://$CLOUDFRONT_DOMAIN (when CloudFront is ready)

## Next Steps
1. Configure your domain name (optional)
2. Set up SSL certificate for custom domain
3. Configure Twilio webhook URL: http://$ALB_DNS/api/webhooks/sms
4. Add your Twilio credentials to the application

## Monitoring
- **CloudWatch Logs**: /ecs/$PROJECT_NAME-api
- **ECS Console**: AWS Console > ECS > $PROJECT_NAME-cluster
- **CloudFront Console**: AWS Console > CloudFront > $CLOUDFRONT_ID

Generated: $(date)
EOF

echo "✅ Frontend deployment complete!"
echo ""
echo "📋 Deployment Summary:"
echo "   Website URL: https://$CLOUDFRONT_DOMAIN"
echo "   API Endpoint: http://$ALB_DNS/api"
echo "   Health Check: http://$ALB_DNS/api/health"
echo ""
echo "⏳ CloudFront distribution is deploying (10-15 minutes)"
echo "📄 Full deployment details: deploy/deployment-summary.md"
echo ""
echo "🎉 Rita SMS Survey Platform is now deployed to AWS!"