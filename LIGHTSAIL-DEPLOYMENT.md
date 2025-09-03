# Rita SMS Survey Platform - Amazon Lightsail Deployment Guide

## 🚀 Manual Deployment to Amazon Lightsail Node.js Server

This guide provides step-by-step instructions for manually deploying the Rita SMS Survey Platform to an Amazon Lightsail Node.js server from your GitHub repository.

## 📋 Prerequisites

Before starting the deployment, ensure you have:

1. **Amazon Lightsail Node.js Instance** (minimum 2GB RAM recommended)
2. **GitHub Repository** with your Rita project
3. **Twilio Account** with SMS credentials
4. **MongoDB Atlas** or **Amazon DocumentDB** for database (optional - app can run without DB)
5. **Domain Name** (optional, for custom domain)

## 🎯 Step 1: Create Lightsail Instance

### 1.1 Create Node.js Instance
1. Log into [AWS Lightsail Console](https://lightsail.aws.amazon.com/)
2. Click **"Create Instance"**
3. Choose **"Linux/Unix"** platform
4. Select **"Node.js"** blueprint
5. Choose instance plan:
   - **$10/month (2GB RAM, 1 vCPU)** - Minimum recommended
   - **$20/month (4GB RAM, 2 vCPU)** - Better performance
6. Name your instance: `rita-sms-platform`
7. Click **"Create Instance"**

### 1.2 Configure Networking
1. Go to your instance page
2. Click **"Networking"** tab
3. Add firewall rules:
   - **HTTP** (port 80) - Allow all traffic
   - **HTTPS** (port 443) - Allow all traffic
   - **Custom** (port 3001) - Allow all traffic (for initial testing)
   - ❌ MongoDB (port 27017) - Do NOT open publicly. Only open if absolutely required and restrict to specific IPs. Prefer MongoDB Atlas or keep local MongoDB bound to localhost (no external access).

## 🎯 Step 2: Connect to Your Instance

### 2.1 SSH Connection
1. In Lightsail console, click **"Connect using SSH"**
2. Or use SSH client:
```bash
ssh -i /path/to/your/key.pem bitnami@YOUR-INSTANCE-IP
```

### 2.2 Initial Server Setup
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y git curl wget unzip

# Check Node.js version (should be 18.x or higher)
node --version
npm --version

# Install PM2 for process management
sudo npm install -g pm2
```

## 🎯 Step 3: Clone Your Repository

### 3.1 Clone from GitHub
```bash
# Navigate to the application directory
cd /opt/bitnami/apache/htdocs

# Remove default files
sudo rm -rf *

# Clone your Rita repository
sudo git clone https://github.com/YOUR-USERNAME/Rita.git .

# Change ownership to bitnami user
sudo chown -R bitnami:bitnami /opt/bitnami/apache/htdocs/
```

### 3.2 Alternative: Upload Files
If you prefer to upload files directly:
```bash
# Create project directory
mkdir -p ~/rita-app
cd ~/rita-app

# Upload your project files using SCP or SFTP
# Example with SCP:
scp -i /path/to/key.pem -r /path/to/local/Rita/* bitnami@YOUR-INSTANCE-IP:~/rita-app/
```

## 🎯 Step 4: Install Dependencies

```bash
# Navigate to project directory
cd /opt/bitnami/apache/htdocs  # or ~/rita-app

# Install Node.js dependencies
npm install

# Build the frontend
npm run build

# Install global dependencies if needed
sudo npm install -g nodemon concurrently webpack webpack-cli
```

## 🎯 Step 5: Environment Configuration

### 5.1 Create Production Environment File
```bash
# Create production environment file
cp .env.production.example .env.production

# Edit the environment file
nano .env.production
```

### 5.2 Configure Environment Variables
Edit `.env.production` with your settings:

```bash
# Application Configuration
NODE_ENV=production
PORT=3001
BUSINESS_NAME="Your Business Name"

# Database (Optional - app works without DB)
# For MongoDB Atlas:
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rita?retryWrites=true&w=majority

# For Amazon DocumentDB:
# MONGODB_URI=mongodb://username:password@docdb-cluster.us-east-1.docdb.amazonaws.com:27017/rita?ssl=true&retryWrites=false

# Twilio SMS Configuration (Required for SMS functionality)
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Security
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key!!

# Performance & Features
MAX_FILE_SIZE=10485760
REQUEST_TIMEOUT=30000
DEBUG_SMS=false
ENABLE_WEBHOOKS=true

# Logging
LOG_LEVEL=info
```

### 5.3 Set File Permissions
```bash
# Set proper permissions for environment file
chmod 600 .env.production

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

# Ensure all files have proper permissions
find . -type f -name "*.js" -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;
```

## 🎯 Step 6: Database Setup (Optional)

### Option A: MongoDB Atlas (Cloud Database)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Create database user
4. Add your Lightsail IP to whitelist
5. Get connection string and add to `.env.production`

### Option B: Local MongoDB (On Lightsail)
```bash
# For Ubuntu 22.04+ - Install libssl1.1 compatibility
wget http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb
sudo dpkg -i libssl1.1_1.1.1f-1ubuntu2_amd64.deb

# Install MongoDB (Ubuntu/Debian)
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Update environment file
MONGODB_URI=mongodb://localhost:27017/rita
```

### 6.3 MongoDB Networking and Ports (Should you open 27017?)

- Recommended: Do NOT open MongoDB port 27017 to the public internet.
- Use one of these secure patterns:
  - MongoDB Atlas: Keep the database in Atlas and allowlist your Lightsail static IP. No inbound Mongo port needs to be open on your Lightsail instance.
  - Amazon DocumentDB: Runs inside a VPC. Open inbound 27017 in the DocumentDB security group only to the peered Lightsail/VPC CIDR or the specific Lightsail instance IP. You do not open 27017 in the Lightsail firewall for DocumentDB because it’s outbound from the app to AWS.
  - Local MongoDB on Lightsail: Keep bind IP set to 127.0.0.1 only (default) so it’s accessible only from the same instance. Do not open port 27017 in Lightsail firewall or UFW.

#### If you must allow remote access temporarily (not recommended):
- Limit access strictly to trusted IPs.
- Configure both Layers:
  1) Lightsail Firewall: Add a custom TCP rule for 27017 restricted to your office/static IP only (never 0.0.0.0/0).
  2) OS Firewall (UFW):
     ```bash
     sudo ufw allow from <YOUR_TRUSTED_IP> to any port 27017 proto tcp
     sudo ufw deny 27017/tcp  # deny others
     sudo ufw status numbered
     ```
- Ensure MongoDB is configured with authentication and TLS if exposed.
- Prefer using an SSH tunnel for admin access instead of opening the port:
  ```bash
  ssh -i /path/to/key.pem -L 27018:127.0.0.1:27017 bitnami@YOUR-INSTANCE-IP
  # Then connect locally to mongodb://localhost:27018
  ```

#### Summary
- Atlas/DocumentDB: No Mongo port open on Lightsail; control access via provider’s allowlist/security groups.
- Local Mongo on same instance: Keep it bound to localhost; do not open 27017 externally.
- Only open 27017 if absolutely necessary, and restrict aggressively.

## 🎯 Step 7: Configure Web Server

### 7.1 Apache Configuration (Lightsail Default)
```bash
# Enable required Apache modules first
sudo /opt/bitnami/apache/bin/httpd -M | grep -E "(rewrite|proxy)"

# If modules are not loaded, enable them
echo "LoadModule rewrite_module modules/mod_rewrite.so" | sudo tee -a /opt/bitnami/apache/conf/httpd.conf
echo "LoadModule proxy_module modules/mod_proxy.so" | sudo tee -a /opt/bitnami/apache/conf/httpd.conf
echo "LoadModule proxy_http_module modules/mod_proxy_http.so" | sudo tee -a /opt/bitnami/apache/conf/httpd.conf

# Create Apache virtual host configuration
sudo nano /opt/bitnami/apache/conf/vhosts/rita-app.conf
```

Add the following configuration:
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /opt/bitnami/apache/htdocs/dist
    
    # Serve React app static files
    <Directory "/opt/bitnami/apache/htdocs/dist">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Handle React Router
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Proxy API requests to Node.js app
    ProxyPreserveHost On
    ProxyPass /api/ http://localhost:3001/api/
    ProxyPassReverse /api/ http://localhost:3001/api/
    
    ErrorLog /opt/bitnami/apache/logs/rita_error.log
    CustomLog /opt/bitnami/apache/logs/rita_access.log common
</VirtualHost>
```

### 7.2 Enable Required Modules
```bash
# Enable Apache modules
sudo /opt/bitnami/apache/bin/httpd -M | grep rewrite
sudo /opt/bitnami/apache/bin/httpd -M | grep proxy

# If modules are missing, enable them
# (Usually pre-enabled in Lightsail Node.js blueprint)

# Restart Apache
sudo /opt/bitnami/ctlscript.sh restart apache
```

## 🎯 Step 8: Start the Application

### 8.1 Test the Application
```bash
# Test the application manually first
cd /opt/bitnami/apache/htdocs
npm start

# Check if it starts without errors
# Press Ctrl+C to stop after testing
```

### 8.2 Start with PM2 (Production)
```bash
# Start the application with PM2
pm2 start src/server/index.js --name "rita-api" --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/opt/bitnami/nodejs/bin /opt/bitnami/nodejs/lib/node_modules/pm2/bin/pm2 startup systemd -u bitnami --hp /home/bitnami

# Check application status
pm2 status
pm2 logs rita-api
```

## 🎯 Step 9: Configure Domain (Optional)

### 9.1 Static IP Assignment
1. In Lightsail console, go to **"Networking"**
2. Click **"Create static IP"**
3. Attach to your instance

### 9.2 DNS Configuration
1. Point your domain to the static IP:
   - **A Record**: `@` → `YOUR-STATIC-IP`
   - **CNAME**: `www` → `your-domain.com`

### 9.3 SSL Certificate Setup
```bash
# Install Certbot for Let's Encrypt SSL
sudo apt install -y snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Obtain SSL certificate
sudo certbot --apache -d your-domain.com -d www.your-domain.com

# Test certificate auto-renewal
sudo certbot renew --dry-run
```

## 🎯 Step 10: Twilio Webhook Configuration

### 10.1 Configure Twilio Webhook
1. Log into [Twilio Console](https://console.twilio.com/)
2. Go to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click your Twilio phone number
4. Set webhook URL:
   - **HTTP POST**: `http://your-domain.com/api/webhooks/sms`
   - Or with IP: `http://YOUR-STATIC-IP/api/webhooks/sms`

## 🎯 Step 11: Testing & Verification

### 11.1 Health Check
```bash
# Test API health endpoint
curl http://localhost:3001/api/health
curl http://your-domain.com/api/health

# Expected response:
{
  "status": "ok",
  "service": "Rita SMS Survey Platform",
  "version": "1.0.0",
  "environment": "production",
  "database": { "connected": true },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 11.2 Frontend Test
- Visit: `http://your-domain.com`
- Should load the Rita dashboard interface

### 11.3 SMS Test (if Twilio configured)
```bash
# Test SMS functionality
curl -X POST http://your-domain.com/api/test-sms \
  -H "Content-Type: application/json"
```

## 🎯 Step 12: Monitoring & Maintenance

### 12.1 PM2 Monitoring
```bash
# Monitor application
pm2 monit

# View logs
pm2 logs rita-api --lines 100

# Restart application
pm2 restart rita-api

# View process status
pm2 status
```

### 12.2 Setup Log Rotation
```bash
# Configure PM2 log rotation
pm2 install pm2-logrotate

# Configure rotation settings
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 12.3 Backup Strategy
```bash
# Create backup script
nano ~/backup-rita.sh
```

Add backup script content:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/bitnami/backups"
APP_DIR="/opt/bitnami/apache/htdocs"

mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/rita-app-$DATE.tar.gz -C $APP_DIR .

# Backup database (if using local MongoDB)
# mongodump --out $BACKUP_DIR/rita-db-$DATE

# Keep only last 7 backups
find $BACKUP_DIR -name "rita-app-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable and add to cron:
```bash
chmod +x ~/backup-rita.sh

# Add to crontab (daily backup at 2 AM)
crontab -e
0 2 * * * /home/bitnami/backup-rita.sh
```

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Application Won't Start
```bash
# Check logs
pm2 logs rita-api

# Common fixes:
npm install  # Reinstall dependencies
pm2 restart rita-api  # Restart application
pm2 delete rita-api && pm2 start src/server/index.js --name "rita-api" --env production
```

#### Database Connection Issues
```bash
# Check MongoDB status (if using local)
sudo systemctl status mongod

# Test connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(err => console.log(err))"
```

#### SSL Certificate Issues
```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

#### Apache Configuration Issues
```bash
# Test Apache configuration syntax
sudo /opt/bitnami/apache/bin/httpd -t

# Check if virtual host file exists and has correct syntax
sudo /opt/bitnami/apache/bin/httpd -S

# If ErrorLog syntax error persists, recreate the config file
sudo rm /opt/bitnami/apache/conf/vhosts/rita-app.conf
sudo nano /opt/bitnami/apache/conf/vhosts/rita-app.conf

# Make sure to use absolute paths for log files
# ErrorLog /opt/bitnami/apache/logs/rita_error.log
# CustomLog /opt/bitnami/apache/logs/rita_access.log common
```

#### Port Conflicts
```bash
# Check what's using port 3001
sudo netstat -tulpn | grep :3001

# Kill process if needed
sudo fuser -k 3001/tcp
```

### Performance Optimization

#### 1. Enable Gzip Compression
Add to Apache config:
```apache
LoadModule deflate_module modules/mod_deflate.so
<Location />
    SetOutputFilter DEFLATE
</Location>
```

#### 2. Configure Caching
Add to Apache config:
```apache
LoadModule expires_module modules/mod_expires.so
ExpiresActive On
ExpiresByType text/css "access plus 1 month"
ExpiresByType application/javascript "access plus 1 month"
ExpiresByType image/png "access plus 1 month"
```

## 📊 Monitoring & Analytics

### Resource Monitoring
```bash
# System resources
htop
df -h
free -m

# Application monitoring
pm2 monit
tail -f /opt/bitnami/apache/logs/error_log
```

### Application Metrics
- API health: `/api/health`
- Survey statistics: `/api/survey/stats`
- Customer data: `/api/customers`

## 🔐 Security Best Practices

### 1. Firewall Configuration
```bash
# Basic UFW firewall setup
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
```

### 2. Regular Updates
```bash
# System updates
sudo apt update && sudo apt upgrade -y

# Node.js security updates
npm audit fix

# PM2 updates
pm2 update
```

### 3. Environment Security
- Keep `.env.production` secure (chmod 600)
- Use strong JWT secrets (32+ characters)
- Regularly rotate Twilio tokens
- Monitor access logs

## 🚀 Deployment Checklist

- [ ] Lightsail instance created and running
- [ ] Repository cloned and dependencies installed
- [ ] Environment variables configured
- [ ] Database connected (if using)
- [ ] Twilio credentials configured
- [ ] Apache virtual host configured
- [ ] SSL certificate installed (if using domain)
- [ ] PM2 process manager running application
- [ ] Twilio webhook configured
- [ ] Health check passes
- [ ] Frontend loads correctly
- [ ] SMS functionality tested
- [ ] Backups configured
- [ ] Monitoring setup

## 📞 Support & Updates

### Application Updates
```bash
# Pull latest changes
cd /opt/bitnami/apache/htdocs
git pull origin main

# Install new dependencies
npm install

# Rebuild frontend
npm run build

# Restart application
pm2 restart rita-api
```

### Getting Help
- Check CloudWatch logs in AWS console
- Review PM2 logs: `pm2 logs rita-api`
- Test API endpoints individually
- Verify environment configuration

---

**Deployment completed!** 🎉

Your Rita SMS Survey Platform should now be running on your Amazon Lightsail instance. The application will be available at your domain or static IP address.

**Next Steps:**
1. Configure your first survey
2. Import customer data
3. Test SMS functionality
4. Monitor application performance
5. Set up regular backups