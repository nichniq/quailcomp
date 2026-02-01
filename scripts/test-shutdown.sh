#!/bin/bash
#
# Test script for graceful shutdown functionality
#
# Usage: bash scripts/test-shutdown.sh

set -euo pipefail

LOG_FILE=$(mktemp)

# Set minimal required environment variables
export DATABASE_URL="postgresql://test:test@localhost:5432/test"
export JWT_SECRET="test-secret-key-minimum-32-characters-long-for-testing"

echo "Starting server (output in $LOG_FILE)..."
bun run server/src/index.ts > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
sleep 3

echo "Sending SIGTERM..."
kill -TERM $SERVER_PID

# Wait for graceful shutdown
sleep 2

# Check if process is still running
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "ERROR: Server still running after graceful shutdown"
    kill -9 $SERVER_PID
    rm -f "$LOG_FILE"
    exit 1
fi

# Check for graceful shutdown message in logs
if grep -q "shutting down gracefully" "$LOG_FILE"; then
    echo "✓ SUCCESS: Server shutdown gracefully"
    echo "✓ Found graceful shutdown message in logs"
    rm -f "$LOG_FILE"
    exit 0
else
    echo "ERROR: Graceful shutdown message not found in logs"
    cat "$LOG_FILE"
    rm -f "$LOG_FILE"
    exit 1
fi
