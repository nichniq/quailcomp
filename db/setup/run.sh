#!/usr/bin/env bash

# To prevent partially-applied db setup, exit immediately if:
# - any command exits with a non-zero status (-e)
# - an unset variable is referenced (-u)
# - any command in a pipeline fails (pipefail)

set -euo pipefail

echo "Starting quailcomp database setup..."

# Resolve absolute path of this script's directory. This allows
# it to be run from anywhere.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env if present
# This allows local development without exporting variables manually

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  echo "Loading environment variables from .env"
  set -a            # automatically export all variables
  source "$SCRIPT_DIR/.env"
  set +a
fi

# Verify that env variables required by psql are set

REQUIRED_VARS=(
  PGHOST
  PGPORT
  PGUSER
  # PGPASSWORD # Add password if you know you need it
  PGDATABASE
)

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: required environment variable '$var' is not set"
    exit 1
  fi
done

# Execute setup files order:
# 1. Roles must exist before databases can be owned
# 2. Database must exist before schemas can be altered
# 3. Schemas must exist before privileges can be applied
#
# -v ON_ERROR_STOP=1 tells psql to immediately stop if any SQL
# statement fails instead of continuing silently.

psql -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/001_roles.sql"
psql -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/002_database.sql"
psql -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/003_schemas.sql"
psql -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/004_privileges.sql"

echo "Quailcomp database setup completed successfully."
