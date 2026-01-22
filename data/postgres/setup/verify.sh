#!/usr/bin/env bash

# Verification script for quailcomp database setup
# This script checks that all roles, databases, schemas, and privileges
# are configured correctly after running the setup scripts

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Resolve absolute path of this script's directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env if present
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  echo -e "${BLUE}Loading environment variables from .env${NC}"
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# Verify that required env variables are set
REQUIRED_VARS=(
  PGHOST
  PGPORT
  PGUSER
  PGDATABASE
)

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo -e "${RED}Error: required environment variable '$var' is not set${NC}"
    exit 1
  fi
done

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Quailcomp Database Setup Verification${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++)) || true
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++)) || true
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++)) || true
}

section() {
  echo ""
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}$(printf '%.0s-' {1..60})${NC}"
}

# Check if a role exists
check_role() {
  local role_name=$1
  local expected_login=$2

  result=$(psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$role_name';")

  if [[ "$result" == "1" ]]; then
    pass "Role '$role_name' exists"

    # Check login capability
    can_login=$(psql -d postgres -tAc "SELECT rolcanlogin FROM pg_roles WHERE rolname = '$role_name';")
    if [[ "$can_login" == "$expected_login" ]]; then
      pass "Role '$role_name' has correct login capability (LOGIN=$expected_login)"
    else
      fail "Role '$role_name' has incorrect login capability (expected $expected_login, got $can_login)"
    fi
  else
    fail "Role '$role_name' does not exist"
  fi
}

# Check if database exists
check_database() {
  local db_name=$1
  local expected_owner=$2

  result=$(psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db_name';")

  if [[ "$result" == "1" ]]; then
    pass "Database '$db_name' exists"

    # Check ownership
    owner=$(psql -d postgres -tAc "SELECT pg_catalog.pg_get_userbyid(d.datdba) FROM pg_catalog.pg_database d WHERE d.datname = '$db_name';")
    if [[ "$owner" == "$expected_owner" ]]; then
      pass "Database '$db_name' is owned by '$expected_owner'"
    else
      fail "Database '$db_name' has incorrect owner (expected $expected_owner, got $owner)"
    fi
  else
    fail "Database '$db_name' does not exist"
  fi
}

# Check schema ownership
check_schema_owner() {
  local db_name=$1
  local schema_name=$2
  local expected_owner=$3

  owner=$(psql -d "$db_name" -tAc "SELECT pg_catalog.pg_get_userbyid(s.nspowner) FROM pg_catalog.pg_namespace s WHERE s.nspname = '$schema_name';")

  if [[ -n "$owner" ]]; then
    if [[ "$owner" == "$expected_owner" ]]; then
      pass "Schema '$schema_name' is owned by '$expected_owner'"
    else
      fail "Schema '$schema_name' has incorrect owner (expected $expected_owner, got $owner)"
    fi
  else
    fail "Schema '$schema_name' does not exist in database '$db_name'"
  fi
}

# Check database privileges
check_database_privileges() {
  local db_name=$1
  local role_name=$2
  local privilege=$3

  has_privilege=$(psql -d postgres -tAc "SELECT has_database_privilege('$role_name', '$db_name', '$privilege');")

  if [[ "$has_privilege" == "t" ]]; then
    pass "Role '$role_name' has $privilege privilege on database '$db_name'"
  else
    fail "Role '$role_name' does not have $privilege privilege on database '$db_name'"
  fi
}

# Check schema privileges
check_schema_privileges() {
  local db_name=$1
  local schema_name=$2
  local role_name=$3
  local privilege=$4

  has_privilege=$(psql -d "$db_name" -tAc "SELECT has_schema_privilege('$role_name', '$schema_name', '$privilege');")

  if [[ "$has_privilege" == "t" ]]; then
    pass "Role '$role_name' has $privilege privilege on schema '$schema_name'"
  else
    fail "Role '$role_name' does not have $privilege privilege on schema '$schema_name'"
  fi
}

# Check PUBLIC has no privileges
check_public_no_privileges() {
  local db_name=$1

  # Check CONNECT privilege
  public_connect=$(psql -d postgres -tAc "SELECT has_database_privilege('public', '$db_name', 'CONNECT');")
  if [[ "$public_connect" == "f" ]]; then
    pass "PUBLIC does not have CONNECT privilege on database '$db_name'"
  else
    fail "PUBLIC has CONNECT privilege on database '$db_name' (should be revoked)"
  fi

  # Check schema USAGE privilege
  public_usage=$(psql -d "$db_name" -tAc "SELECT has_schema_privilege('public', 'public', 'USAGE');")
  if [[ "$public_usage" == "f" ]]; then
    pass "PUBLIC does not have USAGE privilege on schema 'public'"
  else
    fail "PUBLIC has USAGE privilege on schema 'public' (should be revoked)"
  fi
}

# Check default privileges
check_default_privileges() {
  local db_name=$1

  default_privs=$(psql -d "$db_name" -tAc "
    SELECT COUNT(*)
    FROM pg_default_acl da
    JOIN pg_roles r ON da.defaclrole = r.oid
    WHERE r.rolname = 'quailcomp_owner'
      AND da.defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  ")

  if [[ "$default_privs" -gt "0" ]]; then
    pass "Default privileges are configured for quailcomp_owner"
  else
    warn "No default privileges found for quailcomp_owner (may not be set yet)"
  fi
}

# Check connection as quailcomp_app
check_app_connection() {
  if [[ -z "${QUAILCOMP_APP_PASSWORD:-}" ]]; then
    warn "QUAILCOMP_APP_PASSWORD not set, skipping application connection test"
    return
  fi

  # Try to connect as quailcomp_app
  if PGUSER=quailcomp_app PGPASSWORD="$QUAILCOMP_APP_PASSWORD" PGDATABASE=quailcomp psql -tAc "SELECT 1;" &>/dev/null; then
    pass "Successfully connected as 'quailcomp_app'"
  else
    fail "Failed to connect as 'quailcomp_app'"
  fi
}

# Run verification checks

section "1. Checking Roles"
check_role "quailcomp_owner" "f"
check_role "quailcomp_app" "t"

section "2. Checking Database"
check_database "quailcomp" "quailcomp_owner"

section "3. Checking Schema Ownership"
check_schema_owner "quailcomp" "public" "quailcomp_owner"

section "4. Checking Database Privileges"
check_database_privileges "quailcomp" "quailcomp_app" "CONNECT"
check_public_no_privileges "quailcomp"

section "5. Checking Schema Privileges"
check_schema_privileges "quailcomp" "public" "quailcomp_owner" "USAGE"
check_schema_privileges "quailcomp" "public" "quailcomp_owner" "CREATE"
check_schema_privileges "quailcomp" "public" "quailcomp_app" "USAGE"

# quailcomp_app should NOT have CREATE
app_create=$(psql -d "quailcomp" -tAc "SELECT has_schema_privilege('quailcomp_app', 'public', 'CREATE');")
if [[ "$app_create" == "f" ]]; then
  pass "Role 'quailcomp_app' does not have CREATE privilege on schema 'public' (correct)"
else
  fail "Role 'quailcomp_app' has CREATE privilege on schema 'public' (should not have)"
fi

section "6. Checking Default Privileges"
check_default_privileges "quailcomp"

section "7. Checking Application Connection"
check_app_connection

# Summary
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${RED}Failed:${NC}   $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}Verification FAILED. Please review the errors above.${NC}"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}Verification completed with warnings.${NC}"
  exit 0
else
  echo -e "${GREEN}All checks PASSED! Database setup is correct.${NC}"
  exit 0
fi
