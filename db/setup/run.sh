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
