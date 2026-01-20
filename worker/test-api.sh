#!/bin/bash
# Test script for Taste Map API

echo "🎬 Taste Map API Test Script"
echo "=============================="
echo ""

# Check if worker is running
echo "1. Testing health endpoint..."
HEALTH=$(curl -s http://localhost:8787/health)
if [ $? -eq 0 ]; then
    echo "✅ Health check passed: $HEALTH"
else
    echo "❌ Worker not running. Start with: npm run dev"
    exit 1
fi

echo ""
echo "2. Testing CORS preflight..."
CORS=$(curl -s -X OPTIONS http://localhost:8787/api/movies -I | grep -i access-control)
if [ ! -z "$CORS" ]; then
    echo "✅ CORS headers present"
else
    echo "❌ CORS headers missing"
fi

echo ""
echo "3. Testing 404 handling..."
NOT_FOUND=$(curl -s http://localhost:8787/nonexistent)
if echo "$NOT_FOUND" | grep -q "Route not found"; then
    echo "✅ 404 error handling works"
else
    echo "❌ 404 error handling failed"
fi

echo ""
echo "4. Testing movies list endpoint..."
MOVIES=$(curl -s http://localhost:8787/api/movies)
if echo "$MOVIES" | grep -q "movies"; then
    echo "✅ Movies endpoint responding"
else
    echo "⚠️  Movies endpoint error (expected if database not set up)"
    echo "   Response: $MOVIES"
fi

echo ""
echo "5. Testing single movie endpoint..."
MOVIE=$(curl -s http://localhost:8787/api/movies/tt0111161)
if echo "$MOVIE" | grep -q "error"; then
    echo "⚠️  Movie not found (expected if database empty)"
else
    echo "✅ Single movie endpoint works"
fi

echo ""
echo "=============================="
echo "✨ Basic tests complete!"
echo ""
echo "Next steps:"
echo "  1. Create D1 database: wrangler d1 create tastemap_db"
echo "  2. Update wrangler.toml with database_id"
echo "  3. Apply schema: wrangler d1 execute tastemap_db --file=schema.sql --remote"
echo "  4. Set secrets: wrangler secret put TMDB_API_KEY"
echo "  5. Set secrets: wrangler secret put IMPORT_SECRET"
echo "  6. Test import: curl -X POST http://localhost:8787/api/movies/import ..."
