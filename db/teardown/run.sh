#!/usr/bin/env bash

# To prevent partially-applied db teardown, exit immediately if:
# - any command exits with a non-zero status (-e)
# - an unset variable is referenced (-u)
# - any command in a pipeline fails (pipefail)

set -euo pipefail

# Disallow in production

if [[ "${ENVIRONMENT:-}" == "production" ]]; then
  echo "Refusing to run teardown in production"
  exit 1
fi

# Resolve absolute path of this script's directory
# This allows it to be run from anywhere and locate SQL files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env if present

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  echo "Loading environment variables from .env"
  set -a # export following vars to environment
  source "$SCRIPT_DIR/.env"
  set +a # turn off automatic export
fi

# Verify that env variables required by psql are set

REQUIRED_VARS=(
  PGHOST
  PGPORT
  PGUSER
  # PGPASSWORD # Add password if needed
  PGDATABASE
)

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: required environment variable '$var' is not set"
    exit 1
  fi
done

# Require confirmation before continuing

echo "⚠️ DESTRUCTIVE OPERATION WARNING ⚠️"
echo "This will permanently delete:"
echo "  - Database: quailcomp"
echo "  - Roles: quailcomp_app, quailcomp_owner"

read -r -p "Type 'DROP quailcomp' to continue: " CONFIRM

if [[ "$CONFIRM" != "DROP quailcomp" ]]; then
  echo "Confirmation failed. Aborting"
  exit 1
fi

# Execute setup files order:
# 1. Database connections must be terminated before db can be dropped
# 2. Objects owned by a role must be dropped before role can be
#
# -v ON_ERROR_STOP=1 - Stop immediately if any statement fails

echo "Starting quailcomp database teardown..."

psql -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/001_terminate_connections.sql"
psql -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/002_drop_database.sql"
psql -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/003_drop_roles.sql"

echo "Quailcomp database teardown completed successfully"
