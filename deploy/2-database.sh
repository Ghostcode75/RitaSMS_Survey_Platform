#!/bin/bash

# Rita SMS Survey Platform - DocumentDB Setup Script
# Creates DocumentDB cluster and configures database

set -e

# Load configuration
if [ -f "deploy/aws-config.env" ]; then
    source deploy/aws-config.env
else
    echo "❌ aws-config.env not found. Please run 1-infrastructure.sh first"
    exit 1
fi

PROJECT_NAME="rita-sms-survey"
ENVIRONMENT=${ENVIRONMENT:-production}

echo "🍃 Setting up DocumentDB for Rita SMS Survey Platform"

# Check if subnet group exists and verify VPC
echo "🔍 Checking existing DocumentDB subnet group..."
EXISTING_VPC=$(aws docdb describe-db-subnet-groups \
    --db-subnet-group-name "$PROJECT_NAME-docdb-subnet-group" \
    --query 'DBSubnetGroups[0].VpcId' \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "none")

if [ "$EXISTING_VPC" != "none" ] && [ "$EXISTING_VPC" != "$VPC_ID" ]; then
    echo "🧹 Cleaning up subnet group from different VPC ($EXISTING_VPC)..."
    aws docdb delete-db-subnet-group \
        --db-subnet-group-name "$PROJECT_NAME-docdb-subnet-group" \
        --region $AWS_REGION
    sleep 5
    EXISTING_VPC="none"
fi

if [ "$EXISTING_VPC" = "none" ]; then
    echo "📊 Creating DocumentDB subnet group..."
    echo "   Using VPC: $VPC_ID"
    echo "   Using subnets: $PRIVATE_SUBNET_1_ID, $PRIVATE_SUBNET_2_ID"
    aws docdb create-db-subnet-group \
        --db-subnet-group-name "$PROJECT_NAME-docdb-subnet-group" \
        --db-subnet-group-description "DocumentDB subnet group for Rita" \
        --subnet-ids $PRIVATE_SUBNET_1_ID $PRIVATE_SUBNET_2_ID \
        --region $AWS_REGION
else
    echo "✅ Subnet group already exists in correct VPC ($VPC_ID)"
fi

# Create DocumentDB cluster parameter group
echo "⚙️  Creating DocumentDB parameter group..."
aws docdb create-db-cluster-parameter-group \
    --db-cluster-parameter-group-name "$PROJECT_NAME-docdb-params" \
    --db-parameter-group-family docdb5.0 \
    --description "DocumentDB parameter group for Rita" \
    --region $AWS_REGION || echo "Parameter group may already exist"

# Create DocumentDB cluster
echo "🗄️  Creating DocumentDB cluster..."
DOCDB_CLUSTER_ID="$PROJECT_NAME-docdb-cluster"

# Generate a secure password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

aws docdb create-db-cluster \
    --db-cluster-identifier $DOCDB_CLUSTER_ID \
    --engine docdb \
    --master-username "ritaadmin" \
    --master-user-password "$DB_PASSWORD" \
    --db-subnet-group-name "$PROJECT_NAME-docdb-subnet-group" \
    --db-cluster-parameter-group-name "$PROJECT_NAME-docdb-params" \
    --vpc-security-group-ids $DB_SG_ID \
    --backup-retention-period 7 \
    --preferred-backup-window "07:00-09:00" \
    --preferred-maintenance-window "sun:09:00-sun:11:00" \
    --storage-encrypted \
    --region $AWS_REGION || echo "Cluster may already exist"

echo "⏳ Waiting for cluster to be available..."
# DocumentDB doesn't have a cluster wait command, so we'll poll manually
while true; do
    CLUSTER_STATUS=$(aws docdb describe-db-clusters \
        --db-cluster-identifier $DOCDB_CLUSTER_ID \
        --query 'DBClusters[0].Status' \
        --output text \
        --region $AWS_REGION 2>/dev/null || echo "creating")
    
    if [ "$CLUSTER_STATUS" = "available" ]; then
        echo "✅ Cluster is available"
        break
    elif [ "$CLUSTER_STATUS" = "failed" ]; then
        echo "❌ Cluster creation failed"
        exit 1
    else
        echo "📊 Cluster status: $CLUSTER_STATUS (waiting...)"
        sleep 30
    fi
done

# Create DocumentDB instance
echo "💻 Creating DocumentDB instance..."
aws docdb create-db-instance \
    --db-instance-identifier "$DOCDB_CLUSTER_ID-instance-1" \
    --db-instance-class db.t3.medium \
    --engine docdb \
    --db-cluster-identifier $DOCDB_CLUSTER_ID \
    --region $AWS_REGION || echo "Instance may already exist"

echo "⏳ Waiting for instance to be available..."
aws docdb wait db-instance-available --db-instance-identifier "$DOCDB_CLUSTER_ID-instance-1" --region $AWS_REGION

# Get cluster endpoint
DOCDB_ENDPOINT=$(aws docdb describe-db-clusters \
    --db-cluster-identifier $DOCDB_CLUSTER_ID \
    --query 'DBClusters[0].Endpoint' \
    --output text \
    --region $AWS_REGION)

echo "✅ DocumentDB cluster created successfully!"

# Create AWS Secrets Manager secret for database credentials
echo "🔐 Creating database credentials in AWS Secrets Manager..."
aws secretsmanager create-secret \
    --name "$PROJECT_NAME/database" \
    --description "Database credentials for Rita SMS Survey Platform" \
    --secret-string "{\"username\":\"ritaadmin\",\"password\":\"$DB_PASSWORD\",\"endpoint\":\"$DOCDB_ENDPOINT\",\"port\":\"27017\"}" \
    --region $AWS_REGION || aws secretsmanager update-secret \
    --secret-id "$PROJECT_NAME/database" \
    --secret-string "{\"username\":\"ritaadmin\",\"password\":\"$DB_PASSWORD\",\"endpoint\":\"$DOCDB_ENDPOINT\",\"port\":\"27017\"}" \
    --region $AWS_REGION

# Update configuration file
cat >> deploy/aws-config.env << EOF

# DocumentDB Configuration
DOCDB_CLUSTER_ID=$DOCDB_CLUSTER_ID
DOCDB_ENDPOINT=$DOCDB_ENDPOINT
DOCDB_USERNAME=ritaadmin
SECRETS_NAME=$PROJECT_NAME/database
EOF

echo "📝 DocumentDB configuration added to deploy/aws-config.env"

# Download DocumentDB CA certificate
echo "📜 Downloading DocumentDB CA certificate..."
mkdir -p deploy/certs
curl -o deploy/certs/rds-ca-2019-root.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

echo "🎉 DocumentDB setup complete!"
echo ""
echo "📋 Connection Details:"
echo "   Endpoint: $DOCDB_ENDPOINT"
echo "   Username: ritaadmin"
echo "   Password: Stored in AWS Secrets Manager"
echo "   Secret Name: $PROJECT_NAME/database"
echo ""
echo "🔗 Connection String:"
echo "   mongodb://ritaadmin:[PASSWORD]@$DOCDB_ENDPOINT:27017/rita?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
echo ""
echo "Next step: Run ./deploy/3-backend.sh to deploy the API"