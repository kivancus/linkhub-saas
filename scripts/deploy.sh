#!/bin/bash

# Production deployment script for LinkHub SaaS

set -e

echo "🚀 Starting LinkHub production deployment..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is required"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET environment variable is required"
    exit 1
fi

# Build the application
echo "📦 Building application..."
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Seed the database with initial data
echo "🌱 Seeding database..."
npm run db:seed

# Start the application
echo "✅ Deployment complete! Starting application..."
npm start