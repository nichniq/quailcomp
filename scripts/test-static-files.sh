#!/bin/bash
#
# Test script for static file serving in production mode
#
# Usage: bash scripts/test-static-files.sh

set -euo pipefail

cd "$(dirname "$0")/.."

export NODE_ENV=production
export DATABASE_URL="postgresql://test:test@localhost:5432/test"
export JWT_SECRET="test-secret-key-minimum-32-characters-long-for-testing"

echo "Starting server in production mode..."
bun run server/src/index.ts > /dev/null 2>&1 &
SERVER_PID=$!

sleep 3

echo "Testing static file serving..."
echo "1. Testing root path (/)..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
if [ "$RESPONSE" = "200" ]; then
    echo "   ✓ Root path returns 200"
else
    echo "   ✗ Root path returns $RESPONSE"
    kill -9 $SERVER_PID
    exit 1
fi

echo "2. Testing SPA fallback (/some-spa-route)..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/some-spa-route)
if [ "$RESPONSE" = "200" ]; then
    echo "   ✓ SPA fallback works (serves index.html for non-API routes)"
else
    echo "   ✗ SPA fallback returns $RESPONSE"
    kill -9 $SERVER_PID
    exit 1
fi

echo "3. Checking HTML content..."
CONTENT=$(curl -s http://localhost:3000/ | grep -ic "<!doctype")
if [ "$CONTENT" -gt 0 ]; then
    echo "   ✓ HTML content served"
else
    echo "   ✗ No HTML content found"
    echo "   Content received:"
    curl -s http://localhost:3000/ | head -10
    kill -9 $SERVER_PID
    exit 1
fi

echo ""
echo "✓ All static file serving tests passed!"

echo "Stopping server..."
kill -TERM $SERVER_PID 2>/dev/null || kill -9 $SERVER_PID 2>/dev/null
sleep 2

exit 0
