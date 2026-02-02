#!/bin/bash
#
# Quailcomp Health Check Script
#
# This script checks if the Quailcomp application is running and healthy.
# Designed for use with cron, monitoring systems, or manual checks.
#
# Exit codes:
#   0 - Application is healthy
#   1 - Application is unhealthy or unreachable
#
# Usage:
#   ./healthcheck.sh [url]
#
# Configuration via environment variables:
#   HEALTH_URL      - Health check URL (default: http://localhost:3000/health)
#   HEALTH_TIMEOUT  - Request timeout in seconds (default: 5)
#   QUIET           - Suppress output (default: false)

set -eo pipefail

# Configuration
HEALTH_URL="${1:-${HEALTH_URL:-http://localhost:3000/health}}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-5}"
QUIET="${QUIET:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Output functions
log_success() {
    if [[ "${QUIET}" != "true" ]]; then
        echo -e "${GREEN}✓ $1${NC}"
    fi
}

log_error() {
    if [[ "${QUIET}" != "true" ]]; then
        echo -e "${RED}✗ $1${NC}" >&2
    fi
}

log_info() {
    if [[ "${QUIET}" != "true" ]]; then
        echo "$1"
    fi
}

# Check if curl is available
if ! command -v curl &> /dev/null; then
    log_error "curl not found. Please install curl to run health checks."
    exit 1
fi

# Perform health check
log_info "Checking application health: ${HEALTH_URL}"

# Make request and capture response
HTTP_CODE=$(curl -s -o /tmp/healthcheck-response.json -w "%{http_code}" \
    --max-time "${HEALTH_TIMEOUT}" \
    --connect-timeout "${HEALTH_TIMEOUT}" \
    "${HEALTH_URL}" 2>/dev/null || echo "000")

# Check HTTP status code
if [[ "${HTTP_CODE}" == "200" ]]; then
    # Check if response is valid JSON with status=ok
    if command -v jq &> /dev/null; then
        # Use jq if available for proper JSON parsing
        STATUS=$(jq -r '.status // empty' /tmp/healthcheck-response.json 2>/dev/null || echo "")
        if [[ "${STATUS}" == "ok" ]]; then
            log_success "Application is healthy (HTTP ${HTTP_CODE})"

            # Show additional info if available
            if [[ "${QUIET}" != "true" ]]; then
                UPTIME=$(jq -r '.uptime // empty' /tmp/healthcheck-response.json 2>/dev/null || echo "")
                DB_STATUS=$(jq -r '.database // empty' /tmp/healthcheck-response.json 2>/dev/null || echo "")

                if [[ -n "${UPTIME}" ]]; then
                    UPTIME_HOURS=$(echo "scale=2; ${UPTIME} / 3600" | bc 2>/dev/null || echo "${UPTIME}s")
                    log_info "  Uptime: ${UPTIME_HOURS} hours"
                fi

                if [[ -n "${DB_STATUS}" ]]; then
                    log_info "  Database: ${DB_STATUS}"
                fi
            fi

            rm -f /tmp/healthcheck-response.json
            exit 0
        else
            log_error "Application returned unexpected status: ${STATUS}"
            rm -f /tmp/healthcheck-response.json
            exit 1
        fi
    else
        # Fallback: basic grep check if jq is not available
        if grep -q '"status":"ok"' /tmp/healthcheck-response.json 2>/dev/null; then
            log_success "Application is healthy (HTTP ${HTTP_CODE})"
            rm -f /tmp/healthcheck-response.json
            exit 0
        else
            log_error "Application returned invalid response"
            if [[ "${QUIET}" != "true" ]]; then
                cat /tmp/healthcheck-response.json
            fi
            rm -f /tmp/healthcheck-response.json
            exit 1
        fi
    fi
elif [[ "${HTTP_CODE}" == "000" ]]; then
    log_error "Failed to connect to application (timeout or connection refused)"
    rm -f /tmp/healthcheck-response.json
    exit 1
else
    log_error "Application returned HTTP ${HTTP_CODE}"
    if [[ "${QUIET}" != "true" && -f /tmp/healthcheck-response.json ]]; then
        cat /tmp/healthcheck-response.json
    fi
    rm -f /tmp/healthcheck-response.json
    exit 1
fi
