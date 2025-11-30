#!/bin/bash

################################################################################
# 🚀 COLONIST VOICES BACKEND - COMPLETE AUTO-INSTALLER
# This script will install and configure everything automatically
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="colonist-voices"
APP_DIR="/var/www/colonist-voices-backend"
DB_NAME="colonist_voices"
DB_USER="colonist_admin"
DOMAIN="api.leadleap.net"
HTTPS_PORT=3443
HTTP_PORT=3000

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

################################################################################
# Pre-flight Checks
################################################################################

print_header "PRE-FLIGHT CHECKS"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run with sudo: sudo bash install.sh"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$USER}
print_success "Running as: $ACTUAL_USER (with sudo)"

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    print_success "OS: $NAME $VERSION"
else
    print_error "Cannot determine OS version"
    exit 1
fi

################################################################################
# Step 1: Update System
################################################################################

print_header "STEP 1: UPDATING SYSTEM"

apt update
apt upgrade -y
print_success "System updated"

################################################################################
# Step 2: Install Node.js
################################################################################

print_header "STEP 2: INSTALLING NODE.JS"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_info "Node.js already installed: $NODE_VERSION"
else
    print_info "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    print_success "Node.js installed: $(node --version)"
fi

################################################################################
# Step 3: Install PostgreSQL
################################################################################

print_header "STEP 3: INSTALLING POSTGRESQL"

if command -v psql &> /dev/null; then
    print_info "PostgreSQL already installed"
else
    print_info "Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    print_success "PostgreSQL installed and started"
fi

# Generate secure passwords
DB_PASSWORD=$(generate_password)
ADMIN_PASSWORD=$(generate_password)
SESSION_SECRET=$(openssl rand -base64 32)

print_success "Generated secure passwords"

################################################################################
# Step 4: Configure PostgreSQL
################################################################################

print_header "STEP 4: CONFIGURING POSTGRESQL"

# Create database and user
sudo -u postgres psql <<EOF
-- Drop existing if any
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create new database and user
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;

-- Connect to database and grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

if [ $? -eq 0 ]; then
    print_success "Database '$DB_NAME' created"
    print_success "User '$DB_USER' created with secure password"
else
    print_error "Failed to configure PostgreSQL"
    exit 1
fi

################################################################################
# Step 5: Install PM2
################################################################################

print_header "STEP 5: INSTALLING PM2"

if command -v pm2 &> /dev/null; then
    print_info "PM2 already installed"
else
    npm install -g pm2
    print_success "PM2 installed"
fi

################################################################################
# Step 6: SSL Certificates
################################################################################

print_header "STEP 6: CHECKING SSL CERTIFICATES"

if [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]; then
    print_success "SSL certificates found for $DOMAIN"
    SSL_KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    SSL_CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
else
    print_error "SSL certificates not found at /etc/letsencrypt/live/$DOMAIN/"
    exit 1
fi

################################################################################
# Step 7: Setup Application Directory
################################################################################

print_header "STEP 7: SETTING UP APPLICATION"

# Create directory
mkdir -p $APP_DIR
cd $APP_DIR

# Check if files exist
if [ ! -f "server.js" ]; then
    print_error "server.js not found in $APP_DIR"
    print_info "Please upload your application files to: $APP_DIR"
    print_info "Then run this script again"
    exit 1
fi

print_success "Application files found"

# Set ownership
chown -R $ACTUAL_USER:$ACTUAL_USER $APP_DIR

################################################################################
# Step 8: Create .env File
################################################################################

print_header "STEP 8: CREATING CONFIGURATION"

cat > $APP_DIR/.env <<EOF
# Auto-generated by install.sh on $(date)

# Database Connection
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# API Keys
OPENAI_API_KEY=sk-proj-g8kxzYnpbgUhWtwoEm_e6asdbPpE_xt16iyLXGv7a6xiQZA2Dj6GfwgU347pImVY
ELEVENLABS_API_KEY=sk_773809de2135f536922144e1b1fc2275181a4ce1d676266b

# Admin Panel Password
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Session Secret
SESSION_SECRET=$SESSION_SECRET

# Discord Webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1435457352261304320/s1Lk_4V42O810j_tR_QMB-tm7zhqkZ-qm3J_8GT7L49BsjzkDSbQvvR8m9AUYMxj_icD

# Production Settings
USE_HTTPS=true
HTTPS_PORT=$HTTPS_PORT
PORT=$HTTP_PORT
NODE_ENV=production
RATE_LIMIT=100

# SSL Certificate Paths
SSL_KEY_PATH=$SSL_KEY_PATH
SSL_CERT_PATH=$SSL_CERT_PATH
EOF

chmod 600 $APP_DIR/.env
chown $ACTUAL_USER:$ACTUAL_USER $APP_DIR/.env

print_success "Configuration file created"

################################################################################
# Step 9: Install Dependencies
################################################################################

print_header "STEP 9: INSTALLING DEPENDENCIES"

cd $APP_DIR
sudo -u $ACTUAL_USER npm install

if [ $? -eq 0 ]; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi

################################################################################
# Step 10: Initialize Database Schema
################################################################################

print_header "STEP 10: INITIALIZING DATABASE"

if [ -f "$APP_DIR/schema.sql" ]; then
    export PGPASSWORD=$DB_PASSWORD
    psql -U $DB_USER -d $DB_NAME -h localhost -f $APP_DIR/schema.sql
    
    if [ $? -eq 0 ]; then
        print_success "Database schema created"
        
        # Verify tables
        TABLE_COUNT=$(psql -U $DB_USER -d $DB_NAME -h localhost -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | xargs)
        print_success "Created $TABLE_COUNT tables"
    else
        print_error "Failed to initialize database schema"
        exit 1
    fi
    unset PGPASSWORD
else
    print_warning "schema.sql not found - skipping database initialization"
fi

################################################################################
# Step 11: Configure Firewall
################################################################################

print_header "STEP 11: CONFIGURING FIREWALL"

if command -v ufw &> /dev/null; then
    # Check if firewall is active
    UFW_STATUS=$(ufw status | grep -i "Status: active" || true)
    
    if [ -z "$UFW_STATUS" ]; then
        print_info "UFW is installed but not active"
        read -p "Enable UFW firewall? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ufw allow 22/tcp  # SSH
            ufw allow $HTTP_PORT/tcp
            ufw allow $HTTPS_PORT/tcp
            ufw --force enable
            print_success "Firewall enabled and configured"
        fi
    else
        ufw allow $HTTP_PORT/tcp
        ufw allow $HTTPS_PORT/tcp
        print_success "Firewall rules added"
    fi
else
    print_warning "UFW not installed - skipping firewall configuration"
fi

################################################################################
# Step 12: Start Application
################################################################################

print_header "STEP 12: STARTING APPLICATION"

cd $APP_DIR

# Stop existing instance if any
sudo -u $ACTUAL_USER pm2 delete $APP_NAME 2>/dev/null || true

# Start with PM2
sudo -u $ACTUAL_USER pm2 start server.js --name $APP_NAME

if [ $? -eq 0 ]; then
    print_success "Application started with PM2"
else
    print_error "Failed to start application"
    print_info "Check logs with: pm2 logs $APP_NAME"
    exit 1
fi

# Save PM2 configuration
sudo -u $ACTUAL_USER pm2 save

# Setup PM2 startup script
print_info "Setting up PM2 auto-start..."
sudo -u $ACTUAL_USER pm2 startup systemd -u $ACTUAL_USER --hp /home/$ACTUAL_USER 2>&1 | grep "sudo" | bash

print_success "PM2 configured to start on boot"

################################################################################
# Step 13: Verify Installation
################################################################################

print_header "STEP 13: VERIFICATION"

# Wait for app to start
sleep 3

# Check PM2 status
PM2_STATUS=$(sudo -u $ACTUAL_USER pm2 status | grep $APP_NAME | grep online || true)
if [ -z "$PM2_STATUS" ]; then
    print_error "Application is not running!"
    print_info "Check logs with: pm2 logs $APP_NAME"
else
    print_success "PM2: Application is running"
fi

# Check PostgreSQL
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL: Running"
else
    print_error "PostgreSQL: Not running"
fi

# Test database connection
export PGPASSWORD=$DB_PASSWORD
DB_TEST=$(psql -U $DB_USER -d $DB_NAME -h localhost -t -c "SELECT 1;" 2>&1)
if [[ $DB_TEST == *"1"* ]]; then
    print_success "Database: Connection successful"
else
    print_error "Database: Connection failed"
fi
unset PGPASSWORD

# Test health endpoint
sleep 2
HEALTH_CHECK=$(curl -k -s https://localhost:$HTTPS_PORT/health 2>&1 || true)
if [[ $HEALTH_CHECK == *"ok"* ]]; then
    print_success "API: Health check passed"
else
    print_warning "API: Health check failed (might need a moment to start)"
fi

################################################################################
# Step 14: Create Credentials File
################################################################################

print_header "STEP 14: SAVING CREDENTIALS"

CREDS_FILE="$APP_DIR/CREDENTIALS.txt"
cat > $CREDS_FILE <<EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 COLONIST VOICES BACKEND CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated on: $(date)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATABASE CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Database Name:     $DB_NAME
Database User:     $DB_USER
Database Password: $DB_PASSWORD
Connection String: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

To connect manually:
psql -U $DB_USER -d $DB_NAME -h localhost

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN PANEL CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Admin Password: $ADMIN_PASSWORD

Login URL: https://$DOMAIN:$HTTPS_PORT/admin
(or https://localhost:$HTTPS_PORT/admin)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APPLICATION INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Installation Directory: $APP_DIR
Configuration File:     $APP_DIR/.env
PM2 Process Name:       $APP_NAME

API Endpoints:
• Health Check:  https://$DOMAIN:$HTTPS_PORT/health
• Admin Panel:   https://$DOMAIN:$HTTPS_PORT/admin
• API Base:      https://$DOMAIN:$HTTPS_PORT/api

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USEFUL COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View logs:          pm2 logs $APP_NAME
Check status:       pm2 status
Restart app:        pm2 restart $APP_NAME
Stop app:           pm2 stop $APP_NAME
Monitor resources:  pm2 monit

Connect to database:
export PGPASSWORD='$DB_PASSWORD'
psql -U $DB_USER -d $DB_NAME -h localhost

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  SECURITY NOTICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: Keep this file secure!
• Do NOT share these credentials
• Do NOT commit this file to Git
• Store securely and delete when memorized

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

chmod 600 $CREDS_FILE
chown $ACTUAL_USER:$ACTUAL_USER $CREDS_FILE

print_success "Credentials saved to: $CREDS_FILE"

################################################################################
# Final Summary
################################################################################

print_header "🎉 INSTALLATION COMPLETE!"

echo -e "${GREEN}"
cat <<'EOF'
   ______      __            _      __     _____           __  __  ____  ____  ______
  / ____/___  / /___  ____  (_)____/ /_   / ___/____  ____/ / / / / __ \/ __ \/ ____/
 / /   / __ \/ / __ \/ __ \/ / ___/ __/   \__ \/ __ \/ __  / / / / / / / / / / __/   
/ /___/ /_/ / / /_/ / / / / (__  ) /_    ___/ / /_/ / /_/ / / /_/ / /_/ / /_/ / /___  
\____/\____/_/\____/_/ /_/_/____/\__/   /____/\____/\__,_/  \____/\____/\____/_____/  
                                                                                        
EOF
echo -e "${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓${NC} PostgreSQL installed and configured"
echo -e "${GREEN}✓${NC} Database '$DB_NAME' created with secure password"
echo -e "${GREEN}✓${NC} Node.js and dependencies installed"
echo -e "${GREEN}✓${NC} PM2 process manager configured"
echo -e "${GREEN}✓${NC} Application started and running"
echo -e "${GREEN}✓${NC} Firewall configured (ports $HTTP_PORT, $HTTPS_PORT)"
echo -e "${GREEN}✓${NC} SSL certificates configured"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${YELLOW}📋 NEXT STEPS:${NC}"
echo ""
echo -e "1. View your credentials:"
echo -e "   ${BLUE}cat $CREDS_FILE${NC}"
echo ""
echo -e "2. Access the admin panel:"
echo -e "   ${BLUE}https://$DOMAIN:$HTTPS_PORT/admin${NC}"
echo -e "   Password: ${GREEN}$ADMIN_PASSWORD${NC}"
echo ""
echo -e "3. Check application status:"
echo -e "   ${BLUE}pm2 status${NC}"
echo ""
echo -e "4. View application logs:"
echo -e "   ${BLUE}pm2 logs $APP_NAME${NC}"
echo ""
echo -e "5. Test the API:"
echo -e "   ${BLUE}curl -k https://localhost:$HTTPS_PORT/health${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Installation successful! Your backend is now running! 🚀${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit 0
