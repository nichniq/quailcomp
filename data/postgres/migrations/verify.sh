#!/usr/bin/env bash

# Verification script for database migrations
# Checks that all migrations have been applied correctly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env if present
# Only load variables that are not already set (respect existing env)

load_env_if_unset() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    while IFS='=' read -r key value; do
      # Skip comments and empty lines
      [[ "$key" =~ ^#.*$ ]] && continue
      [[ -z "$key" ]] && continue

      # Only set if not already in environment
      if [[ -z "${!key:-}" ]]; then
        export "$key=$value"
      fi
    done < <(grep -v '^#' "$env_file" | grep -v '^$')
  fi
}

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  load_env_if_unset "$SCRIPT_DIR/.env"
elif [[ -f "$SCRIPT_DIR/../setup/.env" ]]; then
  load_env_if_unset "$SCRIPT_DIR/../setup/.env"
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
PASSED=0
WARNINGS=0
FAILED=0

echo "Migration Verification Report"
echo "============================="
echo ""

# Check 1: Verify schema_migrations table exists
echo "1. Checking schema_migrations table..."
TABLE_EXISTS=$(psql -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations'" || echo "")

if [[ "$TABLE_EXISTS" == "1" ]]; then
  echo -e "   ${GREEN}✓${NC} schema_migrations table exists"
  PASSED=$((PASSED + 1))
else
  echo -e "   ${RED}✗${NC} schema_migrations table does not exist"
  FAILED=$((FAILED + 1))
  exit 1
fi
echo ""

# Check 2: List all applied migrations
echo "2. Applied migrations:"
MIGRATION_COUNT=$(psql -tAc "SELECT COUNT(*) FROM schema_migrations" || echo "0")

if [[ "$MIGRATION_COUNT" -gt "0" ]]; then
  psql -c "SELECT version, applied_at, execution_time_ms FROM schema_migrations ORDER BY version" || echo "Error querying migrations"
  echo -e "   ${GREEN}✓${NC} $MIGRATION_COUNT migration(s) applied"
  PASSED=$((PASSED + 1))
else
  echo -e "   ${YELLOW}⚠${NC} No migrations have been applied yet"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 3: Verify all migration files have corresponding records
echo "3. Checking migration file coverage..."
MIGRATION_FILES=$(ls -1 "$SCRIPT_DIR"/[0-9][0-9][0-9]_*.sql 2>/dev/null | sort || echo "")

if [[ -z "$MIGRATION_FILES" ]]; then
  echo -e "   ${YELLOW}⚠${NC} No migration files found"
  WARNINGS=$((WARNINGS + 1))
else
  FILE_COUNT=$(echo "$MIGRATION_FILES" | wc -l | tr -d ' ')
  MISSING_COUNT=0

  for MIGRATION_FILE in $MIGRATION_FILES; do
    FILENAME=$(basename "$MIGRATION_FILE")
    VERSION="${FILENAME%.sql}"

    EXISTS=$(psql -tAc "SELECT 1 FROM schema_migrations WHERE version = '$VERSION'" || echo "")

    if [[ "$EXISTS" != "1" ]]; then
      echo -e "   ${YELLOW}⚠${NC} Migration file $VERSION not applied"
      MISSING_COUNT=$((MISSING_COUNT + 1))
      WARNINGS=$((WARNINGS + 1))
    fi
  done

  if [[ $MISSING_COUNT -eq 0 ]]; then
    echo -e "   ${GREEN}✓${NC} All $FILE_COUNT migration file(s) have been applied"
    PASSED=$((PASSED + 1))
  else
    echo -e "   ${YELLOW}⚠${NC} $MISSING_COUNT of $FILE_COUNT migration file(s) not yet applied"
  fi
fi
echo ""

# Check 4: Verify checksums match
echo "4. Checking migration checksums..."
CHECKSUM_MISMATCHES=0

for MIGRATION_FILE in $MIGRATION_FILES; do
  FILENAME=$(basename "$MIGRATION_FILE")
  VERSION="${FILENAME%.sql}"

  STORED_CHECKSUM=$(psql -tAc "SELECT checksum FROM schema_migrations WHERE version = '$VERSION'" || echo "")

  if [[ -n "$STORED_CHECKSUM" ]]; then
    CURRENT_CHECKSUM=$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')

    if [[ "$STORED_CHECKSUM" != "$CURRENT_CHECKSUM" ]]; then
      echo -e "   ${YELLOW}⚠${NC} Checksum mismatch: $VERSION"
      echo "      Stored:  $STORED_CHECKSUM"
      echo "      Current: $CURRENT_CHECKSUM"
      CHECKSUM_MISMATCHES=$((CHECKSUM_MISMATCHES + 1))
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
done

if [[ $CHECKSUM_MISMATCHES -eq 0 ]]; then
  echo -e "   ${GREEN}✓${NC} All applied migrations have matching checksums"
  PASSED=$((PASSED + 1))
else
  echo -e "   ${YELLOW}⚠${NC} $CHECKSUM_MISMATCHES migration(s) have checksum mismatches"
  echo "      (Migration files may have been modified after application)"
fi
echo ""

# Summary
echo "============================="
echo "Verification Summary"
echo "============================="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}Verification failed${NC}"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}Verification completed with warnings${NC}"
  exit 0
else
  echo -e "${GREEN}All checks passed${NC}"
  exit 0
fi
