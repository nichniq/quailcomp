#!/bin/bash
#
# Quailcomp Database Backup Script
#
# This script creates compressed PostgreSQL backups with automatic retention.
# Designed to be run as the quailcomp user or via cron.
#
# Usage:
#   ./backup.sh [backup_dir]
#
# Configuration via environment variables:
#   BACKUP_DIR      - Directory to store backups (default: /var/backups/quailcomp)
#   BACKUP_RETENTION - Number of days to retain backups (default: 30)
#   DATABASE_NAME   - PostgreSQL database name (default: quailcomp)
#   PGUSER          - PostgreSQL user (default: quailcomp_owner)
#   PGPASSWORD      - PostgreSQL password (read from .env if not set)

set -euo pipefail

# Configuration
BACKUP_DIR="${1:-${BACKUP_DIR:-/var/backups/quailcomp}}"
BACKUP_RETENTION="${BACKUP_RETENTION:-30}"
DATABASE_NAME="${DATABASE_NAME:-quailcomp}"
PGUSER="${PGUSER:-quailcomp_owner}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/quailcomp-${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Error handler
error_exit() {
    log "ERROR" "$1"
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

# Success message
success() {
    log "INFO" "$1"
    echo -e "${GREEN}✓ $1${NC}"
}

# Warning message
warning() {
    log "WARN" "$1"
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Info message
info() {
    log "INFO" "$1"
    echo "$1"
}

# Check if running as root (not recommended)
if [[ $EUID -eq 0 ]]; then
    warning "Running as root. Consider running as quailcomp user instead."
fi

# Create backup directory if it doesn't exist
if [[ ! -d "${BACKUP_DIR}" ]]; then
    info "Creating backup directory: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}" || error_exit "Failed to create backup directory"
    chmod 750 "${BACKUP_DIR}"
fi

# Initialize log file if it doesn't exist
if [[ ! -f "${LOG_FILE}" ]]; then
    touch "${LOG_FILE}"
    chmod 640 "${LOG_FILE}"
fi

info "========================================="
info "Quailcomp Database Backup"
info "========================================="
info "Timestamp: ${TIMESTAMP}"
info "Database: ${DATABASE_NAME}"
info "Backup file: ${BACKUP_FILE}"
info "Retention: ${BACKUP_RETENTION} days"
info ""

# Check if PostgreSQL is accessible
if ! command -v pg_dump &> /dev/null; then
    error_exit "pg_dump not found. Please install PostgreSQL client tools."
fi

# Load database password from .env if not already set
if [[ -z "${PGPASSWORD:-}" ]]; then
    # Try to find .env file
    ENV_FILE=""
    if [[ -f "/opt/quailcomp/.env" ]]; then
        ENV_FILE="/opt/quailcomp/.env"
    elif [[ -f "$(dirname "$0")/../.env" ]]; then
        ENV_FILE="$(dirname "$0")/../.env"
    elif [[ -f ".env" ]]; then
        ENV_FILE=".env"
    fi

    if [[ -n "${ENV_FILE}" ]]; then
        info "Loading database credentials from ${ENV_FILE}"
        # Extract password from DATABASE_OWNER_URL or DATABASE_URL
        if grep -q "DATABASE_OWNER_URL" "${ENV_FILE}"; then
            PGPASSWORD=$(grep "DATABASE_OWNER_URL" "${ENV_FILE}" | cut -d'=' -f2- | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        elif grep -q "DATABASE_URL" "${ENV_FILE}"; then
            PGPASSWORD=$(grep "DATABASE_URL" "${ENV_FILE}" | cut -d'=' -f2- | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        fi
        export PGPASSWORD
    else
        warning "No .env file found. Ensure PGPASSWORD is set or ~/.pgpass is configured."
    fi
fi

# Test database connection
info "Testing database connection..."
if ! PGPASSWORD="${PGPASSWORD}" psql -U "${PGUSER}" -d "${DATABASE_NAME}" -h localhost -c "SELECT 1;" &> /dev/null; then
    error_exit "Cannot connect to database. Check credentials and PostgreSQL service status."
fi
success "Database connection successful"

# Create backup
info "Creating backup..."
if PGPASSWORD="${PGPASSWORD}" pg_dump -U "${PGUSER}" -h localhost -d "${DATABASE_NAME}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists | gzip > "${BACKUP_FILE}"; then
    success "Backup created successfully"
else
    error_exit "Backup failed"
fi

# Verify backup file exists and is not empty
if [[ ! -f "${BACKUP_FILE}" ]]; then
    error_exit "Backup file not created: ${BACKUP_FILE}"
fi

BACKUP_SIZE=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}" 2>/dev/null)
if [[ ${BACKUP_SIZE} -lt 100 ]]; then
    error_exit "Backup file is too small (${BACKUP_SIZE} bytes). Backup may have failed."
fi

BACKUP_SIZE_MB=$(echo "scale=2; ${BACKUP_SIZE} / 1048576" | bc)
success "Backup size: ${BACKUP_SIZE_MB} MB"

# Set permissions
chmod 640 "${BACKUP_FILE}"
success "Backup permissions set to 640"

# Cleanup old backups
info ""
info "Cleaning up backups older than ${BACKUP_RETENTION} days..."

# Count backups before cleanup
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "quailcomp-*.sql.gz" | wc -l | tr -d ' ')
info "Total backups before cleanup: ${TOTAL_BACKUPS}"

# Find and delete old backups
DELETED_COUNT=0
while IFS= read -r old_backup; do
    if [[ -n "${old_backup}" ]]; then
        info "Deleting old backup: $(basename "${old_backup}")"
        rm -f "${old_backup}"
        ((DELETED_COUNT++))
    fi
done < <(find "${BACKUP_DIR}" -name "quailcomp-*.sql.gz" -type f -mtime +${BACKUP_RETENTION})

if [[ ${DELETED_COUNT} -gt 0 ]]; then
    success "Deleted ${DELETED_COUNT} old backup(s)"
else
    info "No old backups to delete"
fi

# Count remaining backups
REMAINING_BACKUPS=$(find "${BACKUP_DIR}" -name "quailcomp-*.sql.gz" | wc -l | tr -d ' ')
info "Remaining backups: ${REMAINING_BACKUPS}"

# List recent backups
info ""
info "Recent backups:"
find "${BACKUP_DIR}" -name "quailcomp-*.sql.gz" -type f -exec ls -lh {} \; | tail -n 5 | awk '{print "  " $9 " (" $5 ")"}'

info ""
success "Backup completed successfully!"
info "Backup location: ${BACKUP_FILE}"
info "========================================="

exit 0
