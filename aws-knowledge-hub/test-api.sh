#!/bin/bash

# AWS Knowledge Hub API Test Script
# This script tests all major API endpoints to verify the application is working correctly

BASE_URL="http://localhost:3001"
echo "🧪 Testing AWS Knowledge Hub API at $BASE_URL"
echo "=================================================="

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq '.'
echo -e "\n"

# Test 2: Create Session
echo "2. Creating a new session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/sessions/create" \
  -H "Content-Type: application/json" \
  -d '{"preferences": {"theme": "light"}}')
echo "$SESSION_RESPONSE" | jq '.'

# Extract session ID
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.data.sessionId')
echo "Session ID: $SESSION_ID"
echo -e "\n"

# Test 3: Ask a Question (Complete Pipeline)
echo "3. Testing complete Q&A pipeline..."
curl -s -X POST "$BASE_URL/api/answers/complete" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"How do I create an S3 bucket?\", \"sessionId\": \"$SESSION_ID\"}" | jq '.'
echo -e "\n"

# Test 4: Get Session History
echo "4. Getting conversation history..."
curl -s "$BASE_URL/api/sessions/$SESSION_ID/history" | jq '.'
echo -e "\n"

# Test 5: Test Answer Generation
echo "5. Testing answer generation with sample questions..."
curl -s "$BASE_URL/api/answers/test" | jq '.data.summary'
echo -e "\n"

# Test 6: Get Session Stats
echo "6. Getting session statistics..."
curl -s "$BASE_URL/api/sessions/admin/stats" | jq '.'
echo -e "\n"

# Test 7: Database Stats
echo "7. Getting database statistics..."
curl -s "$BASE_URL/api/stats" | jq '.'
echo -e "\n"

echo "✅ All tests completed!"
echo "🌐 Open your browser and go to: $BASE_URL"
echo "💬 Try the chat interface to ask AWS questions!"