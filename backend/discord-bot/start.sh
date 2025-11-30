#!/bin/bash

echo "========================================"
echo "ElevenLabs Key Redemption Bot"
echo "========================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Starting bot..."
echo ""
node bot.js
