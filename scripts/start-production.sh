#!/bin/bash

# Production startup script for LinkHub SaaS

set -e

echo "🚀 Starting LinkHub SaaS in production mode..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is required"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET environment variable is required"
    exit 1
fi

# Set production environment
export NODE_ENV=production

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "✅ Starting LinkHub SaaS server..."
node dist/server.js