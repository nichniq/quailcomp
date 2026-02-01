#!/usr/bin/env bash
set -euo pipefail

# Quailcomp Installation Script
# Installs the application to /opt/quailcomp and configures systemd service

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/quailcomp"
SERVICE_USER="quailcomp"
SERVICE_GROUP="quailcomp"
LOG_DIR="${INSTALL_DIR}/logs"
BACKUP_DIR="/var/backups/quailcomp"

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check for Bun
    if ! command -v bun &> /dev/null; then
        log_error "Bun is not installed. Install from https://bun.sh"
        exit 1
    fi

    # Check for PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_warn "PostgreSQL client (psql) not found. Ensure PostgreSQL 16 is installed."
    fi

    log_info "Prerequisites check passed"
}

create_service_user() {
    log_info "Creating service user ${SERVICE_USER}..."

    if id "${SERVICE_USER}" &>/dev/null; then
        log_warn "User ${SERVICE_USER} already exists"
    else
        useradd --system --home-dir "${INSTALL_DIR}" --shell /bin/bash "${SERVICE_USER}"
        log_info "Created user ${SERVICE_USER}"
    fi
}

create_directories() {
    log_info "Creating directory structure..."

    mkdir -p "${INSTALL_DIR}"
    mkdir -p "${LOG_DIR}"
    mkdir -p "${BACKUP_DIR}"

    log_info "Directories created"
}

copy_application_files() {
    log_info "Copying application files to ${INSTALL_DIR}..."

    # Get the script's directory (deployment/)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

    # Copy application files
    rsync -av --exclude='node_modules' --exclude='.git' --exclude='logs' \
        "${PROJECT_ROOT}/" "${INSTALL_DIR}/"

    log_info "Application files copied"
}

install_dependencies() {
    log_info "Installing dependencies..."

    cd "${INSTALL_DIR}"
    sudo -u "${SERVICE_USER}" bun install --production

    log_info "Dependencies installed"
}

build_frontend() {
    log_info "Building frontend..."

    cd "${INSTALL_DIR}/frontend"
    sudo -u "${SERVICE_USER}" bun install
    sudo -u "${SERVICE_USER}" bun run build

    log_info "Frontend built"
}

setup_environment() {
    log_info "Setting up environment file..."

    if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
        if [[ -f "${INSTALL_DIR}/.env.example" ]]; then
            cp "${INSTALL_DIR}/.env.example" "${INSTALL_DIR}/.env"
            log_warn "Created .env from .env.example - PLEASE EDIT ${INSTALL_DIR}/.env with your configuration"
        else
            log_error ".env.example not found. Please create ${INSTALL_DIR}/.env manually"
            exit 1
        fi
    else
        log_info ".env file already exists"
    fi
}

install_systemd_service() {
    log_info "Installing systemd service..."

    cp "${INSTALL_DIR}/deployment/systemd/quailcomp.service" /etc/systemd/system/
    systemctl daemon-reload

    log_info "Systemd service installed"
}

install_logrotate() {
    log_info "Installing logrotate configuration..."

    cp "${INSTALL_DIR}/deployment/systemd/logrotate.conf" /etc/logrotate.d/quailcomp

    log_info "Logrotate configured"
}

set_permissions() {
    log_info "Setting file permissions..."

    chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${INSTALL_DIR}"
    chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${BACKUP_DIR}"

    chmod 750 "${INSTALL_DIR}"
    chmod 750 "${LOG_DIR}"
    chmod 750 "${BACKUP_DIR}"
    chmod 600 "${INSTALL_DIR}/.env"

    log_info "Permissions set"
}

# Main installation flow
main() {
    log_info "Starting Quailcomp installation..."

    check_root
    check_prerequisites
    create_service_user
    create_directories
    copy_application_files
    install_dependencies
    build_frontend
    setup_environment
    install_systemd_service
    install_logrotate
    set_permissions

    log_info "Installation complete!"
    echo ""
    log_info "Next steps:"
    echo "  1. Edit ${INSTALL_DIR}/.env with your database credentials"
    echo "  2. Run database migrations: cd ${INSTALL_DIR} && sudo -u ${SERVICE_USER} bun run db:migrate"
    echo "  3. Start the service: systemctl start quailcomp"
    echo "  4. Enable auto-start: systemctl enable quailcomp"
    echo "  5. Check status: systemctl status quailcomp"
    echo "  6. View logs: journalctl -u quailcomp -f"
}

main "$@"
