#!/bin/bash

# Rita SMS Survey Platform - VPC Cleanup Script
# Removes all Rita-related VPCs to free up the VPC limit

set -e

AWS_REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="rita-sms-survey"

echo "🧹 Cleaning up Rita SMS Survey Platform VPCs"

# Get all Rita VPCs
RITA_VPCS=$(aws ec2 describe-vpcs \
    --region $AWS_REGION \
    --filters "Name=tag:Name,Values=$PROJECT_NAME-vpc" \
    --query 'Vpcs[*].VpcId' \
    --output text)

if [ -z "$RITA_VPCS" ]; then
    echo "✅ No Rita VPCs found to clean up"
    exit 0
fi

echo "🔍 Found Rita VPCs: $RITA_VPCS"

for VPC_ID in $RITA_VPCS; do
    echo "🗑️  Cleaning up VPC: $VPC_ID"
    
    # Delete NAT gateways first (if any)
    NAT_GATEWAYS=$(aws ec2 describe-nat-gateways \
        --region $AWS_REGION \
        --filter "Name=vpc-id,Values=$VPC_ID" \
        --query 'NatGateways[?State==`available`].NatGatewayId' \
        --output text)
    
    for NAT_ID in $NAT_GATEWAYS; do
        echo "  🚪 Deleting NAT Gateway: $NAT_ID"
        aws ec2 delete-nat-gateway --nat-gateway-id $NAT_ID --region $AWS_REGION || echo "  ⚠️ NAT Gateway may not exist"
    done
    
    # Delete internet gateways
    IGW_IDS=$(aws ec2 describe-internet-gateways \
        --region $AWS_REGION \
        --filters "Name=attachment.vpc-id,Values=$VPC_ID" \
        --query 'InternetGateways[*].InternetGatewayId' \
        --output text)
    
    for IGW_ID in $IGW_IDS; do
        echo "  🌍 Detaching and deleting Internet Gateway: $IGW_ID"
        aws ec2 detach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID --region $AWS_REGION || echo "  ⚠️ IGW may not be attached"
        aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID --region $AWS_REGION || echo "  ⚠️ IGW may not exist"
    done
    
    # Delete route table associations and routes
    ROUTE_TABLES=$(aws ec2 describe-route-tables \
        --region $AWS_REGION \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' \
        --output text)
    
    for RT_ID in $ROUTE_TABLES; do
        echo "  🛣️  Deleting route table: $RT_ID"
        aws ec2 delete-route-table --route-table-id $RT_ID --region $AWS_REGION || echo "  ⚠️ Route table may not exist"
    done
    
    # Delete security groups (except default)
    SECURITY_GROUPS=$(aws ec2 describe-security-groups \
        --region $AWS_REGION \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'SecurityGroups[?GroupName!=`default`].GroupId' \
        --output text)
    
    for SG_ID in $SECURITY_GROUPS; do
        echo "  🔒 Deleting security group: $SG_ID"
        aws ec2 delete-security-group --group-id $SG_ID --region $AWS_REGION || echo "  ⚠️ Security group may not exist"
    done
    
    # Delete subnets
    SUBNETS=$(aws ec2 describe-subnets \
        --region $AWS_REGION \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'Subnets[*].SubnetId' \
        --output text)
    
    for SUBNET_ID in $SUBNETS; do
        echo "  🏢 Deleting subnet: $SUBNET_ID"
        aws ec2 delete-subnet --subnet-id $SUBNET_ID --region $AWS_REGION || echo "  ⚠️ Subnet may not exist"
    done
    
    # Wait a moment for resources to be cleaned up
    sleep 5
    
    # Delete VPC
    echo "  🌐 Deleting VPC: $VPC_ID"
    aws ec2 delete-vpc --vpc-id $VPC_ID --region $AWS_REGION || echo "  ⚠️ VPC may not exist"
    
    echo "  ✅ VPC $VPC_ID cleanup complete"
done

# Clean up any orphaned resources
echo "🧹 Cleaning up any orphaned Rita resources..."

# Delete any remaining DocumentDB resources
aws docdb delete-db-subnet-group \
    --db-subnet-group-name "$PROJECT_NAME-docdb-subnet-group" \
    --region $AWS_REGION 2>/dev/null || echo "No DocumentDB subnet group to clean"

aws docdb delete-db-cluster-parameter-group \
    --db-cluster-parameter-group-name "$PROJECT_NAME-docdb-params" \
    --region $AWS_REGION 2>/dev/null || echo "No DocumentDB parameter group to clean"

# Clean up config file
rm -f deploy/aws-config.env

echo "✅ All Rita VPC cleanup complete!"
echo "🎯 You can now run the deployment again"