# Rita SMS Survey Platform - AWS Deployment

Complete deployment solution for the Rita SMS Survey Platform on AWS using CLI tools and infrastructure as code.

## 🏗️ Architecture Overview

- **Frontend**: React SPA hosted on S3 + CloudFront CDN
- **Backend**: Node.js API on ECS Fargate with Application Load Balancer
- **Database**: Amazon DocumentDB (MongoDB-compatible)
- **Storage**: S3 buckets for static files and uploads
- **Security**: VPC, Security Groups, IAM roles

## 📋 Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Docker** installed and running
3. **Node.js** and npm installed
4. **AWS Account** with sufficient permissions for:
   - VPC, EC2, ECS, ALB
   - S3, CloudFront
   - DocumentDB
   - IAM roles and policies
   - Secrets Manager

## 🚀 Quick Deployment

### Option 1: Complete Deployment (Recommended)
```bash
# Deploy everything at once
./deploy/deploy-all.sh
```

### Option 2: Step-by-Step Deployment
```bash
# 1. Set up AWS CLI (if needed)
./deploy/setup-aws-cli.sh

# 2. Create infrastructure
./deploy/1-infrastructure.sh

# 3. Set up database
./deploy/2-database.sh

# 4. Deploy backend API
./deploy/3-backend.sh

# 5. Deploy frontend
./deploy/4-frontend.sh
```

## ⚙️ Configuration

### Environment Variables
Copy `.env.production.example` to `.env.production` and configure:

```bash
# Required Twilio credentials
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Optional customizations
AWS_REGION=us-east-1
BUSINESS_NAME="Your Business Name"
```

### AWS Region
Set your preferred AWS region:
```bash
export AWS_REGION=us-east-1  # Default
```

## 📊 Cost Estimation

**Monthly AWS costs (approximate):**
- S3 + CloudFront: $10-20
- ECS Fargate (2 tasks): $30-100
- DocumentDB (t3.medium): $50-200
- Application Load Balancer: $25
- **Total**: $115-345/month

Costs vary based on:
- Traffic volume
- Database instance size
- Data transfer
- Storage usage

## 🔧 Scripts Overview

| Script | Purpose |
|--------|---------|
| `setup-aws-cli.sh` | Verify AWS CLI configuration |
| `1-infrastructure.sh` | Create VPC, subnets, security groups |
| `2-database.sh` | Set up DocumentDB cluster |
| `3-backend.sh` | Build and deploy API to ECS |
| `4-frontend.sh` | Deploy React app to S3+CloudFront |
| `deploy-all.sh` | Run complete deployment |
| `cleanup.sh` | Delete all AWS resources |

## 📁 File Structure

```
deploy/
├── README.md                 # This file
├── aws-deployment-plan.md    # Architecture documentation
├── setup-aws-cli.sh         # AWS CLI verification
├── 1-infrastructure.sh      # VPC and networking
├── 2-database.sh           # DocumentDB setup
├── 3-backend.sh            # ECS/Docker deployment
├── 4-frontend.sh           # S3/CloudFront deployment
├── deploy-all.sh           # Complete deployment
├── cleanup.sh              # Resource cleanup
├── aws-config.env          # Generated config (don't commit)
└── deployment-summary.md   # Generated summary
```

## 🔒 Security Features

- **VPC isolation** with public/private subnets
- **Security Groups** with minimal required access
- **IAM roles** following least privilege principle
- **SSL/TLS** encryption in transit
- **Database encryption** at rest
- **Secrets Manager** for sensitive credentials

## 📝 Post-Deployment

### 1. Configure Twilio Webhook
Set your Twilio webhook URL to:
```
http://YOUR-ALB-DNS/api/webhooks/sms
```

### 2. Test Your Deployment
- **Health Check**: `http://YOUR-ALB-DNS/api/health`
- **Website**: `https://YOUR-CLOUDFRONT-DOMAIN`
- **API Test**: `http://YOUR-ALB-DNS/api/getUsername`

### 3. Domain Setup (Optional)
- Purchase domain in Route 53
- Create SSL certificate in Certificate Manager
- Configure custom domain in CloudFront

## 📊 Monitoring

### CloudWatch Dashboards
- ECS service metrics
- Application Load Balancer metrics
- DocumentDB performance

### Log Groups
- `/ecs/rita-sms-survey-api` - Application logs
- ECS container logs
- ALB access logs

## 🧹 Cleanup

To delete all resources and stop AWS charges:
```bash
./deploy/cleanup.sh
```

**⚠️ Warning**: This permanently deletes all data and resources.

## 🔧 Troubleshooting

### Common Issues

**1. Permission Denied**
- Ensure AWS CLI has required permissions
- Check IAM policies for your user/role

**2. Docker Build Fails**
- Verify Docker is running
- Check Dockerfile syntax

**3. ECS Tasks Not Starting**
- Check CloudWatch logs for errors
- Verify task definition CPU/memory limits
- Check security group configurations

**4. Database Connection Issues**
- Verify DocumentDB security group allows ECS access
- Check connection string format
- Ensure SSL is enabled

**5. Frontend Not Loading**
- Wait for CloudFront distribution to deploy (10-15 minutes)
- Check S3 bucket permissions
- Verify API endpoint configuration

### Getting Help

Check logs in AWS CloudWatch:
```bash
aws logs describe-log-groups --region us-east-1
aws logs tail /ecs/rita-sms-survey-api --follow
```

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [DocumentDB User Guide](https://docs.aws.amazon.com/documentdb/)
- [CloudFront Developer Guide](https://docs.aws.amazon.com/cloudfront/)
- [Rita Project Documentation](../docs/README.md)

---

**Generated**: $(date)
**Version**: 1.0.0