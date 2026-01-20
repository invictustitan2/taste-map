#!/bin/bash
# Test script for AI-powered taste profile and recommendations endpoints
# Usage: ./test-ai-endpoints.sh [worker-url]

WORKER_URL="${1:-http://localhost:8787}"

echo "========================================"
echo "Testing AI Endpoints"
echo "Worker URL: $WORKER_URL"
echo "========================================"
echo

# Test 1: Calculate taste profile
echo "1. POST /api/taste-profile - Calculate taste profile"
echo "curl -X POST $WORKER_URL/api/taste-profile"
curl -X POST "$WORKER_URL/api/taste-profile" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo
echo "---"
echo

# Test 2: Get taste profile
echo "2. GET /api/taste-profile - Retrieve taste profile"
echo "curl -X GET $WORKER_URL/api/taste-profile"
curl -X GET "$WORKER_URL/api/taste-profile" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo
echo "---"
echo

# Test 3: Get basic recommendations
echo "3. GET /api/recommendations - Get 5 recommendations"
echo "curl -X GET $WORKER_URL/api/recommendations?count=5"
curl -X GET "$WORKER_URL/api/recommendations?count=5" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo
echo "---"
echo

# Test 4: Get recommendations with filters
echo "4. GET /api/recommendations - With mood and genre filters"
echo "curl -X GET $WORKER_URL/api/recommendations?mood=uplifting&genre=Drama,Comedy&count=3"
curl -X GET "$WORKER_URL/api/recommendations?mood=uplifting&genre=Drama,Comedy&count=3" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo
echo "---"
echo

# Test 5: Get recommendations with era filter
echo "5. GET /api/recommendations - Modern era, 10 results"
echo "curl -X GET $WORKER_URL/api/recommendations?era=modern&count=10"
curl -X GET "$WORKER_URL/api/recommendations?era=modern&count=10" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat
echo
echo "---"
echo

echo "========================================"
echo "Testing complete!"
echo "========================================"
