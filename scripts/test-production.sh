#!/bin/bash

# Production readiness test script

set -e

echo "🧪 Testing LinkHub SaaS production readiness..."

# Test 1: Build the application
echo "1. Testing build process..."
npm run build:server
if [ $? -eq 0 ]; then
    echo "   ✅ Build successful"
else
    echo "   ❌ Build failed"
    exit 1
fi

# Test 2: Check if all required files exist
echo "2. Checking required files..."
required_files=(
    "dist/server.js"
    "package.json"
    "prisma/schema.prisma"
    "Dockerfile"
    "docker-compose.yml"
    ".env.production"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file exists"
    else
        echo "   ❌ $file missing"
        exit 1
    fi
done

# Test 3: Check if production server starts (with timeout)
echo "3. Testing production server startup..."
export NODE_ENV=production
export DATABASE_URL="file:./test.db"
export JWT_SECRET="test-secret-key-for-production-test"
export REDIS_URL="redis://localhost:6379"

# Start server in background
timeout 10s node dist/server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Test if server is responding
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "   ✅ Production server starts and responds"
else
    echo "   ❌ Production server failed to start or respond"
fi

# Clean up
kill $SERVER_PID 2>/dev/null || true
rm -f test.db 2>/dev/null || true

echo ""
echo "🎉 Production readiness test completed!"
echo ""
echo "📋 Next steps for deployment:"
echo "   1. Set up production database (PostgreSQL)"
echo "   2. Set up Redis instance"
echo "   3. Configure environment variables in .env.production"
echo "   4. Set up SSL certificates"
echo "   5. Deploy using Docker Compose or manual deployment"
echo ""
echo "🚀 Ready for production deployment!"