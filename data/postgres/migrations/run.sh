#!/usr/bin/env bash

# To prevent partially-applied migrations, exit immediately if:
# - any command exits with a non-zero status (-e)
# - an unset variable is referenced (-u)
# - any command in a pipeline fails (pipefail)

set -euo pipefail

# Resolve absolute path of this script's directory
# This allows it to be run from anywhere

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env if present
# Try local .env first, then fallback to ../setup/.env
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
  echo "Loading environment variables from migrations/.env (respecting existing)"
  load_env_if_unset "$SCRIPT_DIR/.env"
elif [[ -f "$SCRIPT_DIR/../setup/.env" ]]; then
  echo "Loading environment variables from setup/.env (respecting existing)"
  load_env_if_unset "$SCRIPT_DIR/../setup/.env"
fi

# Verify that env variables required by psql are set

REQUIRED_VARS=(
  PGHOST
  PGPORT
  PGUSER
  PGDATABASE
)

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: required environment variable '$var' is not set"
    exit 1
  fi
done

echo "Starting migrations for database: $PGDATABASE"

# Ensure schema_migrations table exists first
# This must be done before any migration tracking

echo "Ensuring schema_migrations table exists..."
psql -v ON_ERROR_STOP=1 <<EOF
SET ROLE quailcomp_owner;
\i $SCRIPT_DIR/000_migration_tracking.sql
RESET ROLE;
EOF

# Discover all migration files (NNN_*.sql) and sort them

MIGRATION_FILES=$(ls -1 "$SCRIPT_DIR"/[0-9][0-9][0-9]_*.sql 2>/dev/null | sort)

if [[ -z "$MIGRATION_FILES" ]]; then
  echo "No migration files found"
  exit 1
fi

echo "Found $(echo "$MIGRATION_FILES" | wc -l | tr -d ' ') migration file(s)"
echo ""

# Track applied migrations count
APPLIED_COUNT=0
SKIPPED_COUNT=0

# Process each migration file
for MIGRATION_FILE in $MIGRATION_FILES; do
  FILENAME=$(basename "$MIGRATION_FILE")
  VERSION="${FILENAME%.sql}"  # Remove .sql extension

  # Check if migration has already been applied
  APPLIED=$(psql -tAc "SELECT 1 FROM schema_migrations WHERE version = '$VERSION'" || echo "")

  if [[ "$APPLIED" == "1" ]]; then
    # Migration already applied - verify checksum
    STORED_CHECKSUM=$(psql -tAc "SELECT checksum FROM schema_migrations WHERE version = '$VERSION'" || echo "")
    CURRENT_CHECKSUM=$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')

    if [[ "$STORED_CHECKSUM" != "$CURRENT_CHECKSUM" ]]; then
      echo "⚠️  WARNING: Checksum mismatch for $VERSION"
      echo "   Migration file has been modified after application"
      echo "   Stored:  $STORED_CHECKSUM"
      echo "   Current: $CURRENT_CHECKSUM"
      echo ""
    else
      echo "⊘ $VERSION (already applied)"
    fi
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  # Apply new migration
  echo "→ Running $VERSION..."

  # Get milliseconds timestamp (cross-platform)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS doesn't support %3N, use python instead
    START_TIME=$(python3 -c "import time; print(int(time.time() * 1000))" 2>/dev/null || echo "0")
  else
    START_TIME=$(date +%s%3N 2>/dev/null || echo "0")
  fi

  # Execute migration as quailcomp_owner
  psql -v ON_ERROR_STOP=1 <<EOF
SET ROLE quailcomp_owner;
\i $MIGRATION_FILE
RESET ROLE;
EOF

  # Calculate execution time
  if [[ "$OSTYPE" == "darwin"* ]]; then
    END_TIME=$(python3 -c "import time; print(int(time.time() * 1000))" 2>/dev/null || echo "0")
  else
    END_TIME=$(date +%s%3N 2>/dev/null || echo "0")
  fi

  if [[ "$START_TIME" != "0" && "$END_TIME" != "0" ]]; then
    EXECUTION_TIME=$((END_TIME - START_TIME))
  else
    EXECUTION_TIME=0
  fi

  CHECKSUM=$(shasum -a 256 "$MIGRATION_FILE" | awk '{print $1}')

  # Record migration in tracking table
  psql -v ON_ERROR_STOP=1 <<EOF
INSERT INTO schema_migrations (version, checksum, execution_time_ms)
VALUES ('$VERSION', '$CHECKSUM', $EXECUTION_TIME);
EOF

  echo "✓ $VERSION completed (${EXECUTION_TIME}ms)"
  echo ""
  APPLIED_COUNT=$((APPLIED_COUNT + 1))
done

# Grant privileges to quailcomp_app on all tables and sequences
# This ensures any newly created objects are accessible

echo "Granting privileges to quailcomp_app..."
psql -v ON_ERROR_STOP=1 <<EOF
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO quailcomp_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO quailcomp_app;
EOF

echo ""
echo "Migration summary:"
echo "  Applied: $APPLIED_COUNT"
echo "  Skipped: $SKIPPED_COUNT"
echo ""

# Run verification checks
echo "Running verification checks..."
"$SCRIPT_DIR/verify.sh"
