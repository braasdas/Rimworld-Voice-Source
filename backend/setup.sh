#!/bin/bash

# Colonist Voices Backend Setup Script
# This script sets up the database and initial configuration

set -e  # Exit on error

echo "🎮 Colonist Voices Backend Setup"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Please run as root (sudo)"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env from .env.example and configure it first:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

# Load environment variables
source .env

echo "✓ Environment loaded"
echo ""

# Install PostgreSQL if not installed
echo "📦 Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    apt update
    apt install -y postgresql postgresql-contrib
    echo "✓ PostgreSQL installed"
else
    echo "✓ PostgreSQL already installed"
fi

# Start PostgreSQL service
systemctl start postgresql
systemctl enable postgresql
echo "✓ PostgreSQL service started"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "🗄️  Setting up local PostgreSQL database..."
    
    # Generate random password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    DB_USER="colonist_admin"
    DB_NAME="colonist_voices"
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "Database already exists"
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "User already exists"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    sudo -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;"
    
    # Update .env with DATABASE_URL
    DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
    
    if grep -q "^DATABASE_URL=" .env; then
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env
    else
        echo "DATABASE_URL=$DATABASE_URL" >> .env
    fi
    
    echo "✓ Database created: $DB_NAME"
    echo "✓ User created: $DB_USER"
    echo "✓ DATABASE_URL updated in .env"
else
    echo "✓ Using DATABASE_URL from .env"
fi

# Reload environment variables after potential update
source .env

echo ""
echo "📊 Initializing database schema..."

# Run schema.sql
if [ -f schema.sql ]; then
    PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\([^@]*\)@.*/\1/p') \
    psql $DATABASE_URL -f schema.sql
    echo "✓ Database schema created"
else
    echo "❌ schema.sql not found!"
    exit 1
fi

echo ""
echo "📦 Installing Node.js dependencies..."
npm install

echo ""
echo "🔑 Setting up initial ElevenLabs key..."

# Check if ELEVENLABS_API_KEY is set
if [ -z "$ELEVENLABS_API_KEY" ]; then
    echo "⚠️  ELEVENLABS_API_KEY not set in .env"
    echo "Please add your ElevenLabs API key to .env and run setup again"
    exit 1
fi

# Create add-initial-key.js script
cat > add-initial-key.js << 'EOFKEY'
const keyPoolManager = require('./services/keyPoolManager');
require('dotenv').config();

async function addInitialKey() {
    try {
        const key = await keyPoolManager.addKey({
            key_name: 'main_production',
            api_key: process.env.ELEVENLABS_API_KEY,
            tier: 'main',
            cost_per_char: 0.00011,
            monthly_quota: 100000,
            priority: 1,
            notes: 'Main production key - auto-added during setup'
        });
        console.log('✓ Initial key added:', key.key_name);
        process.exit(0);
    } catch (error) {
        if (error.code === '23505') {
            console.log('✓ Key already exists in database');
            process.exit(0);
        }
        console.error('Error adding key:', error.message);
        process.exit(1);
    }
}

addInitialKey();
EOFKEY

# Run the script
node add-initial-key.js
rm add-initial-key.js

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "✓ PostgreSQL database configured"
echo "✓ Database schema initialized"
echo "✓ Node.js dependencies installed"
echo "✓ Initial ElevenLabs key added to pool"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Start the server:"
echo "   pm2 restart colonist-voices"
echo "   pm2 logs colonist-voices"
echo ""
echo "2. Manage keys using the CLI:"
echo "   node manage-keys.js list"
echo "   node manage-keys.js add"
echo "   node manage-keys.js stats"
echo ""
echo "3. Generate supporter codes:"
echo "   node manage-keys.js generate-codes 10"
echo ""
echo "📚 See README.md for full documentation"
echo ""
