# Rita SMS Survey Platform - AWS Deployment Plan

## Architecture Overview

### Application Stack
- **Frontend**: React SPA with Webpack build
- **Backend**: Node.js/Express REST API
- **Database**: MongoDB (to be migrated to DocumentDB)
- **External**: Twilio SMS integration
- **File Storage**: CSV uploads and processing

## AWS Services Architecture

```
Internet → CloudFront → S3 (Static Frontend)
        → ALB → ECS Fargate (Backend API)
              → DocumentDB (Database)
              → S3 (File Storage)
```

## Deployment Components

### 1. Frontend (React SPA)
- **Service**: Amazon S3 + CloudFront
- **Domain**: Custom domain with Route 53
- **SSL**: AWS Certificate Manager
- **Build**: Webpack production build

### 2. Backend API (Node.js)
- **Service**: Amazon ECS with Fargate
- **Container**: Docker containerized application
- **Scaling**: Auto-scaling based on CPU/memory
- **Load Balancer**: Application Load Balancer

### 3. Database
- **Service**: Amazon DocumentDB (MongoDB compatible)
- **Backup**: Automated backups
- **Security**: VPC private subnets

### 4. File Storage
- **Service**: Amazon S3
- **Purpose**: CSV file uploads and processing
- **Access**: IAM roles and policies

### 5. Networking & Security
- **VPC**: Custom VPC with public/private subnets
- **Security Groups**: Restrictive ingress/egress rules
- **WAF**: Web Application Firewall for protection

## Environment Configuration

### Production Environment Variables
```
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://documentdb-cluster:27017/rita
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
AWS_REGION=us-east-1
S3_BUCKET_NAME=rita-uploads
```

## Cost Estimation (Monthly)
- S3 + CloudFront: ~$10-20
- ECS Fargate: ~$30-100 (depending on usage)
- DocumentDB: ~$50-200 (depending on instance size)
- ALB: ~$25
- **Total**: ~$115-345/month

## Deployment Steps

1. **Infrastructure Setup**
   - VPC and networking
   - Security groups
   - DocumentDB cluster
   - S3 buckets

2. **Backend Deployment**
   - Build Docker image
   - Push to ECR
   - Create ECS service
   - Configure ALB

3. **Frontend Deployment**
   - Build React app
   - Upload to S3
   - Configure CloudFront
   - Setup domain

4. **Configuration**
   - Environment variables
   - Database migration
   - SSL certificates

## Monitoring & Maintenance
- CloudWatch logs and metrics
- Health checks and alarms
- Automated backups
- Security updates