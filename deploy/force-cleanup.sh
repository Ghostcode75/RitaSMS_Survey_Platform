#!/bin/bash

# Rita SMS Survey Platform - Force Cleanup Script
# Aggressively removes all Rita resources to free VPC limit

set -e

AWS_REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="rita-sms-survey"

echo "💥 Force cleaning up ALL Rita SMS Survey Platform resources"
echo "⚠️  This will aggressively delete everything Rita-related"

# Get all Rita VPCs
RITA_VPCS=$(aws ec2 describe-vpcs \
    --region $AWS_REGION \
    --filters "Name=tag:Name,Values=$PROJECT_NAME-vpc" \
    --query 'Vpcs[*].VpcId' \
    --output text)

if [ -z "$RITA_VPCS" ]; then
    echo "✅ No Rita VPCs found"
else
    echo "🔍 Found Rita VPCs: $RITA_VPCS"
fi

# Delete ECS clusters and services first
echo "🏗️  Deleting ECS resources..."
ECS_CLUSTERS=$(aws ecs list-clusters --region $AWS_REGION --query 'clusterArns' --output text | grep -i rita || echo "")
for CLUSTER_ARN in $ECS_CLUSTERS; do
    CLUSTER_NAME=$(basename $CLUSTER_ARN)
    echo "  📦 Cleaning cluster: $CLUSTER_NAME"
    
    # Get services in cluster
    SERVICES=$(aws ecs list-services --cluster $CLUSTER_NAME --region $AWS_REGION --query 'serviceArns' --output text)
    for SERVICE_ARN in $SERVICES; do
        SERVICE_NAME=$(basename $SERVICE_ARN)
        echo "    🔄 Stopping service: $SERVICE_NAME"
        aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --desired-count 0 --region $AWS_REGION || echo "    ⚠️ Service may not exist"
    done
    
    # Wait for services to stop
    sleep 10
    
    # Delete services
    for SERVICE_ARN in $SERVICES; do
        SERVICE_NAME=$(basename $SERVICE_ARN)
        echo "    🗑️  Deleting service: $SERVICE_NAME"
        aws ecs delete-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force --region $AWS_REGION || echo "    ⚠️ Service may not exist"
    done
    
    # Delete cluster
    echo "    🏗️  Deleting cluster: $CLUSTER_NAME"
    aws ecs delete-cluster --cluster $CLUSTER_NAME --region $AWS_REGION || echo "    ⚠️ Cluster may not exist"
done

# Delete all ALBs with rita in the name
echo "⚖️  Deleting load balancers..."
ALB_ARNS=$(aws elbv2 describe-load-balancers --region $AWS_REGION --query 'LoadBalancers[*].LoadBalancerArn' --output text)
for ALB_ARN in $ALB_ARNS; do
    ALB_NAME=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].LoadBalancerName' --output text --region $AWS_REGION)
    if [[ $ALB_NAME == *"rita"* ]]; then
        echo "  ⚖️  Deleting ALB: $ALB_NAME ($ALB_ARN)"
        aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN --region $AWS_REGION || echo "  ⚠️ ALB may not exist"
    fi
done

# Delete target groups
echo "🎯 Deleting target groups..."
TG_ARNS=$(aws elbv2 describe-target-groups --region $AWS_REGION --query 'TargetGroups[*].TargetGroupArn' --output text)
for TG_ARN in $TG_ARNS; do
    TG_NAME=$(aws elbv2 describe-target-groups --target-group-arns $TG_ARN --query 'TargetGroups[0].TargetGroupName' --output text --region $AWS_REGION)
    if [[ $TG_NAME == *"rita"* ]]; then
        echo "  🎯 Deleting target group: $TG_NAME"
        aws elbv2 delete-target-group --target-group-arn $TG_ARN --region $AWS_REGION || echo "  ⚠️ Target group may not exist"
    fi
done

# Delete DocumentDB resources
echo "🗄️  Deleting DocumentDB resources..."
DOCDB_INSTANCES=$(aws docdb describe-db-instances --region $AWS_REGION --query 'DBInstances[?contains(DBInstanceIdentifier,`rita`)].DBInstanceIdentifier' --output text)
for INSTANCE_ID in $DOCDB_INSTANCES; do
    echo "  💻 Deleting DocumentDB instance: $INSTANCE_ID"
    aws docdb delete-db-instance --db-instance-identifier $INSTANCE_ID --region $AWS_REGION || echo "  ⚠️ Instance may not exist"
done

# Wait for instances to delete
sleep 30

DOCDB_CLUSTERS=$(aws docdb describe-db-clusters --region $AWS_REGION --query 'DBClusters[?contains(DBClusterIdentifier,`rita`)].DBClusterIdentifier' --output text)
for CLUSTER_ID in $DOCDB_CLUSTERS; do
    echo "  🗄️  Deleting DocumentDB cluster: $CLUSTER_ID"
    aws docdb delete-db-cluster --db-cluster-identifier $CLUSTER_ID --skip-final-snapshot --region $AWS_REGION || echo "  ⚠️ Cluster may not exist"
done

# Delete ECR repositories
echo "📦 Deleting ECR repositories..."
ECR_REPOS=$(aws ecr describe-repositories --region $AWS_REGION --query 'repositories[?contains(repositoryName,`rita`)].repositoryName' --output text)
for REPO_NAME in $ECR_REPOS; do
    echo "  📦 Deleting ECR repository: $REPO_NAME"
    aws ecr delete-repository --repository-name $REPO_NAME --force --region $AWS_REGION || echo "  ⚠️ Repository may not exist"
done

# Delete S3 buckets
echo "🪣 Deleting S3 buckets..."
S3_BUCKETS=$(aws s3api list-buckets --query 'Buckets[?contains(Name,`rita`)].Name' --output text)
for BUCKET_NAME in $S3_BUCKETS; do
    echo "  🪣 Deleting S3 bucket: $BUCKET_NAME"
    aws s3 rm s3://$BUCKET_NAME --recursive || echo "  ⚠️ Bucket may be empty"
    aws s3 rb s3://$BUCKET_NAME || echo "  ⚠️ Bucket may not exist"
done

# Delete Secrets
echo "🔐 Deleting secrets..."
aws secretsmanager delete-secret --secret-id "$PROJECT_NAME/database" --force-delete-without-recovery --region $AWS_REGION || echo "Secret may not exist"

# Delete CloudWatch log groups
echo "📊 Deleting CloudWatch logs..."
aws logs delete-log-group --log-group-name "/ecs/$PROJECT_NAME-api" --region $AWS_REGION || echo "Log group may not exist"

# Wait for everything to be deleted
echo "⏳ Waiting for resources to be fully deleted..."
sleep 60

# Now try to delete VPCs again
for VPC_ID in $RITA_VPCS; do
    echo "🗑️  Force cleaning VPC: $VPC_ID"
    
    # Delete all ENIs in the VPC
    ENI_IDS=$(aws ec2 describe-network-interfaces --region $AWS_REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'NetworkInterfaces[*].NetworkInterfaceId' --output text)
    for ENI_ID in $ENI_IDS; do
        echo "  🔌 Deleting network interface: $ENI_ID"
        aws ec2 delete-network-interface --network-interface-id $ENI_ID --region $AWS_REGION || echo "  ⚠️ ENI may not exist"
    done
    
    # Delete security groups (retry multiple times as they may have dependencies)
    for i in {1..5}; do
        SECURITY_GROUPS=$(aws ec2 describe-security-groups --region $AWS_REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text)
        if [ -z "$SECURITY_GROUPS" ]; then
            break
        fi
        for SG_ID in $SECURITY_GROUPS; do
            echo "  🔒 Attempt $i: Deleting security group: $SG_ID"
            aws ec2 delete-security-group --group-id $SG_ID --region $AWS_REGION || echo "  ⚠️ SG may have dependencies"
        done
        sleep 10
    done
    
    # Delete subnets
    SUBNETS=$(aws ec2 describe-subnets --region $AWS_REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text)
    for SUBNET_ID in $SUBNETS; do
        echo "  🏢 Deleting subnet: $SUBNET_ID"
        aws ec2 delete-subnet --subnet-id $SUBNET_ID --region $AWS_REGION || echo "  ⚠️ Subnet may have dependencies"
    done
    
    # Delete route tables
    ROUTE_TABLES=$(aws ec2 describe-route-tables --region $AWS_REGION --filters "Name=vpc-id,Values=$VPC_ID" --query 'RouteTables[?Associations[0].Main!=`true`].RouteTableId' --output text)
    for RT_ID in $ROUTE_TABLES; do
        echo "  🛣️  Deleting route table: $RT_ID"
        aws ec2 delete-route-table --route-table-id $RT_ID --region $AWS_REGION || echo "  ⚠️ Route table may have dependencies"
    done
    
    # Delete internet gateways
    IGW_IDS=$(aws ec2 describe-internet-gateways --region $AWS_REGION --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'InternetGateways[*].InternetGatewayId' --output text)
    for IGW_ID in $IGW_IDS; do
        echo "  🌍 Detaching and deleting Internet Gateway: $IGW_ID"
        aws ec2 detach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID --region $AWS_REGION || echo "  ⚠️ IGW may not be attached"
        aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID --region $AWS_REGION || echo "  ⚠️ IGW may not exist"
    done
    
    # Wait and try to delete VPC
    sleep 10
    echo "  🌐 Deleting VPC: $VPC_ID"
    aws ec2 delete-vpc --vpc-id $VPC_ID --region $AWS_REGION || echo "  ⚠️ VPC may still have dependencies"
done

# Clean up DocumentDB subnet groups and parameter groups
aws docdb delete-db-subnet-group --db-subnet-group-name "$PROJECT_NAME-docdb-subnet-group" --region $AWS_REGION || echo "No DocumentDB subnet group to clean"
aws docdb delete-db-cluster-parameter-group --db-cluster-parameter-group-name "$PROJECT_NAME-docdb-params" --region $AWS_REGION || echo "No DocumentDB parameter group to clean"

# Clean up config file
rm -f deploy/aws-config.env

echo "💥 Force cleanup complete!"
echo "🔍 Checking remaining VPC count..."
aws ec2 describe-vpcs --region $AWS_REGION --query 'length(Vpcs[])' --output text
echo "🎯 You should now be able to run the deployment"