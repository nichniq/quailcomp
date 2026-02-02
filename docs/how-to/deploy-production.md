# Production Deployment Guide

This guide provides detailed instructions for deploying Quailcomp to a production VPS or dedicated server using systemd for process management.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Database Configuration](#database-configuration)
- [Application Installation](#application-installation)
- [Nginx Reverse Proxy](#nginx-reverse-proxy)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [Service Management](#service-management)
- [Monitoring and Observability](#monitoring-and-observability)
- [Updating the Application](#updating-the-application)
- [Troubleshooting](#troubleshooting)
- [Security Hardening](#security-hardening)

## Prerequisites

### Server Requirements

**Minimum Specifications:**

- Ubuntu 22.04 or 24.04 LTS
- 2 CPU cores
- 2GB RAM (4GB recommended for production)
- 20GB disk space (SSD recommended)
- Public IPv4 address
- Root or sudo access

**Software Requirements:**

- Bun 1.3.6 or higher
- PostgreSQL 16
- Nginx (for reverse proxy)
- Git

### Domain Configuration

Before deployment, ensure you have:

- A registered domain name
- DNS A record pointing to your server's IP address
- Optional: DNS AAAA record for IPv6

## Server Setup

### 1. Initial Server Configuration

Update system packages:

```bash
sudo apt update
sudo apt upgrade -y
```

Install essential tools:

```bash
sudo apt install -y curl wget git build-essential unzip
```

### 2. Install Bun Runtime

Bun is the JavaScript runtime used by Quailcomp. Install it globally:

```bash
curl -fsSL https://bun.sh/install | bash
```

Add Bun to PATH for all users:

```bash
# Add to /etc/profile.d/bun.sh
echo 'export BUN_INSTALL="/root/.bun"' | sudo tee /etc/profile.d/bun.sh
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' | sudo tee -a /etc/profile.d/bun.sh
source /etc/profile.d/bun.sh
```

Verify installation:

```bash
bun --version
# Expected: 1.3.6 or higher
```

### 3. Install PostgreSQL 16

Add PostgreSQL repository:

```bash
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
```

Install PostgreSQL 16:

```bash
sudo apt install -y postgresql-16 postgresql-client-16 postgresql-contrib-16
```

Verify installation:

```bash
sudo systemctl status postgresql
psql --version
# Expected: psql (PostgreSQL) 16.x
```

## Database Configuration

### 1. Create Database Users

Quailcomp uses two database users with different privilege levels:

- `quailcomp_owner`: For migrations and schema changes
- `quailcomp_app`: For runtime operations (limited privileges)

Switch to postgres user:

```bash
sudo -u postgres psql
```

Create users and database:

```sql
-- Create owner user (for migrations)
CREATE USER quailcomp_owner WITH PASSWORD 'CHANGE_THIS_OWNER_PASSWORD';

-- Create application user (for runtime)
CREATE USER quailcomp_app WITH PASSWORD 'CHANGE_THIS_APP_PASSWORD';

-- Create database
CREATE DATABASE quailcomp OWNER quailcomp_owner;

-- Exit psql
\q
```

**Security Note:** Use strong, randomly generated passwords. Example:

```bash
openssl rand -base64 32
```

### 2. Configure PostgreSQL

Edit PostgreSQL configuration for production:

```bash
sudo vim /etc/postgresql/16/main/postgresql.conf
```

Recommended settings for a 4GB RAM server:

```ini
# Connection Settings
max_connections = 100
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 16MB
maintenance_work_mem = 256MB

# WAL Settings
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Query Planner
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200

# Logging
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%m [%p] %u@%d '
log_timezone = 'UTC'
```

Configure client authentication:

```bash
sudo vim /etc/postgresql/16/main/pg_hba.conf
```

Add or modify these lines:

```
# TYPE  DATABASE        USER              ADDRESS         METHOD
local   quailcomp       quailcomp_owner                   md5
local   quailcomp       quailcomp_app                     md5
host    quailcomp       quailcomp_owner   127.0.0.1/32    md5
host    quailcomp       quailcomp_app     127.0.0.1/32    md5
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### 3. Test Database Connections

Test owner connection:

```bash
psql -U quailcomp_owner -d quailcomp -h localhost -W
```

Test app connection:

```bash
psql -U quailcomp_app -d quailcomp -h localhost -W
```

## Application Installation

### 1. Clone Repository

Clone to temporary directory:

```bash
cd /tmp
git clone https://github.com/yourusername/quailcomp.git
cd quailcomp
```

For a specific version/tag:

```bash
git checkout v1.0.0
```

### 2. Run Installation Script

The installation script automates:

- Creating the `quailcomp` system user
- Installing application to `/opt/quailcomp`
- Installing dependencies with Bun
- Building the frontend
- Configuring systemd service
- Setting up log rotation

Run the installer:

```bash
sudo bash deployment/install.sh
```

The script will:

1. Create system user `quailcomp` with home directory `/opt/quailcomp`
2. Copy application files to `/opt/quailcomp`
3. Install dependencies (`bun install`)
4. Build frontend (`bun run build:frontend`)
5. Install systemd service to `/etc/systemd/system/quailcomp.service`
6. Configure logrotate in `/etc/logrotate.d/quailcomp`
7. Create log directory `/var/log/quailcomp`

### 3. Configure Environment Variables

Create production environment file:

```bash
sudo vim /opt/quailcomp/.env
```

Required configuration:

```bash
# === Server Configuration ===
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# === Database Configuration ===
# For runtime operations (quailcomp_app user)
DATABASE_URL=postgresql://quailcomp_app:APP_PASSWORD@localhost:5432/quailcomp

# For migrations (quailcomp_owner user)
DATABASE_OWNER_URL=postgresql://quailcomp_owner:OWNER_PASSWORD@localhost:5432/quailcomp

# Connection pool settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# === Authentication ===
# Generate with: openssl rand -base64 64
JWT_SECRET=your-very-long-random-secret-at-least-64-characters-long

# Token expiration
JWT_EXPIRES_IN=7d

# === CORS Configuration ===
# Comma-separated list of allowed origins
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# === Observability ===
# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# Prometheus metrics
PROMETHEUS_ENABLED=true

# Sentry (optional, for error tracking)
SENTRY_ENABLED=false
# SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# === Security ===
# Password requirements
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_COMPLEXITY=true

# HTTPS redirect (only in production with reverse proxy)
HTTPS_REDIRECT=false

# === Rate Limiting ===
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

Secure the environment file:

```bash
sudo chmod 600 /opt/quailcomp/.env
sudo chown quailcomp:quailcomp /opt/quailcomp/.env
```

### 4. Run Database Migrations

Apply database schema:

```bash
cd /opt/quailcomp
sudo -u quailcomp bun run db:migrate
```

Verify migrations:

```bash
sudo -u quailcomp psql -U quailcomp_app -d quailcomp -h localhost -c "\dt"
```

Expected tables:

- `entities`
- `events`
- `entity_access`
- Migration tracking tables

### 5. Start and Enable Service

Start the service:

```bash
sudo systemctl start quailcomp
```

Check status:

```bash
sudo systemctl status quailcomp
```

Expected output:

```
● quailcomp.service - Quailcomp Book Management API
     Loaded: loaded (/etc/systemd/system/quailcomp.service; enabled)
     Active: active (running) since...
```

Enable auto-start on boot:

```bash
sudo systemctl enable quailcomp
```

View logs:

```bash
sudo journalctl -u quailcomp -f
```

Test health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok","timestamp":"2026-02-01T12:00:00.000Z"}
```

## Nginx Reverse Proxy

### 1. Install Nginx

```bash
sudo apt install -y nginx
```

Start and enable Nginx:

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Create Nginx Configuration

Create site configuration:

```bash
sudo vim /etc/nginx/sites-available/quailcomp
```

Use the configuration from [deployment/nginx/quailcomp.conf](../../deployment/nginx/quailcomp.conf):

```nginx
# HTTP server - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (configured after Let's Encrypt setup)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy settings
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Main application
    location / {
        proxy_pass http://localhost:3000;
    }

    # Health check endpoint (no access logs)
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }

    # Metrics endpoint (optional, restrict access)
    location /metrics {
        proxy_pass http://localhost:3000;
        # Restrict to monitoring systems
        allow 10.0.0.0/8;  # Internal network
        deny all;
    }
}
```

Replace `yourdomain.com` with your actual domain.

### 3. Enable Site Configuration

Create symbolic link:

```bash
sudo ln -s /etc/nginx/sites-available/quailcomp /etc/nginx/sites-enabled/
```

Test configuration:

```bash
sudo nginx -t
```

Expected output:

```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

Reload Nginx:

```bash
sudo systemctl reload nginx
```

## SSL Certificate Setup

### 1. Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtain SSL Certificate

Run certbot:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow prompts:

1. Enter email address for renewal notifications
2. Agree to Terms of Service
3. Choose whether to redirect HTTP to HTTPS (recommended: yes)

### 3. Verify Certificate

Test your SSL configuration:

```bash
curl -I https://yourdomain.com/health
```

Check SSL certificate:

```bash
sudo certbot certificates
```

### 4. Test Auto-Renewal

Certbot installs a cron job for auto-renewal. Test it:

```bash
sudo certbot renew --dry-run
```

Expected output:

```
Congratulations, all simulated renewals succeeded
```

## Service Management

### Systemd Commands

```bash
# Start service
sudo systemctl start quailcomp

# Stop service (graceful shutdown with 10s timeout)
sudo systemctl stop quailcomp

# Restart service
sudo systemctl restart quailcomp

# Reload configuration (if supported)
sudo systemctl reload quailcomp

# View status
sudo systemctl status quailcomp

# Enable auto-start on boot
sudo systemctl enable quailcomp

# Disable auto-start
sudo systemctl disable quailcomp
```

### Log Management

View real-time logs:

```bash
sudo journalctl -u quailcomp -f
```

View recent logs:

```bash
# Last 50 lines
sudo journalctl -u quailcomp -n 50

# Last 100 lines with timestamps
sudo journalctl -u quailcomp -n 100 --no-pager
```

View logs by time range:

```bash
# Today's logs
sudo journalctl -u quailcomp --since today

# Yesterday's logs
sudo journalctl -u quailcomp --since yesterday --until today

# Specific date range
sudo journalctl -u quailcomp --since "2026-02-01 00:00:00" --until "2026-02-01 23:59:59"

# Last hour
sudo journalctl -u quailcomp --since "1 hour ago"
```

Filter logs by priority:

```bash
# Errors only
sudo journalctl -u quailcomp -p err

# Warnings and errors
sudo journalctl -u quailcomp -p warning
```

Log rotation is configured automatically via `/etc/logrotate.d/quailcomp`:

- Daily rotation
- 14 day retention
- Compression enabled
- Automatic cleanup

## Monitoring and Observability

### Health Checks

Application health endpoint:

```bash
curl https://yourdomain.com/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

### Prometheus Metrics

Metrics are exposed at `/metrics` in Prometheus text format:

```bash
curl http://localhost:3000/metrics
```

Example metrics:

```
# HTTP request duration
http_request_duration_seconds_bucket{method="GET",path="/health",status="200",le="0.005"} 100
http_request_duration_seconds_count{method="GET",path="/health",status="200"} 100

# HTTP request count
http_requests_total{method="GET",path="/api/books",status="200"} 1234

# Active connections
http_active_connections 5
```

To scrape with Prometheus, add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'quailcomp'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Automated Monitoring

Use the health check script for automated monitoring:

```bash
/opt/quailcomp/deployment/healthcheck.sh
echo $?  # 0 = healthy, 1 = unhealthy
```

Add to crontab for regular checks:

```bash
sudo crontab -e
```

Add line:

```
*/5 * * * * /opt/quailcomp/deployment/healthcheck.sh || echo "Quailcomp health check failed" | mail -s "Alert: Quailcomp Down" admin@yourdomain.com
```

### Uptime Monitoring Services

Configure external monitoring with services like:

- **UptimeRobot** (free tier available)
- **Pingdom**
- **StatusCake**
- **Healthchecks.io**

Monitor endpoint: `https://yourdomain.com/health`

- Check interval: 5 minutes
- Timeout: 10 seconds
- Expected: HTTP 200 with JSON response

## Updating the Application

### Manual Update Process

1. **Backup current state:**

```bash
# Backup database
sudo -u quailcomp /opt/quailcomp/deployment/backup.sh

# Backup application files (optional)
sudo tar -czf /var/backups/quailcomp-app-$(date +%Y%m%d).tar.gz /opt/quailcomp
```

2. **Stop the service:**

```bash
sudo systemctl stop quailcomp
```

3. **Pull latest changes:**

```bash
cd /opt/quailcomp
sudo -u quailcomp git fetch origin
sudo -u quailcomp git checkout main  # or specific tag/version
sudo -u quailcomp git pull
```

4. **Install dependencies:**

```bash
sudo -u quailcomp bun install
```

5. **Build frontend:**

```bash
cd /opt/quailcomp/frontend
sudo -u quailcomp bun run build
```

6. **Run database migrations:**

```bash
cd /opt/quailcomp
sudo -u quailcomp bun run db:migrate
```

7. **Start service:**

```bash
sudo systemctl start quailcomp
```

8. **Verify deployment:**

```bash
# Check service status
sudo systemctl status quailcomp

# Check logs
sudo journalctl -u quailcomp -n 50

# Test health endpoint
curl https://yourdomain.com/health
```

### Automated Update Script

Create update script at `/opt/quailcomp/update.sh`:

```bash
#!/bin/bash
set -e

echo "Starting Quailcomp update..."

# Backup
echo "Creating backup..."
/opt/quailcomp/deployment/backup.sh

# Stop service
echo "Stopping service..."
systemctl stop quailcomp

# Update code
echo "Pulling latest changes..."
cd /opt/quailcomp
sudo -u quailcomp git pull

# Install dependencies
echo "Installing dependencies..."
sudo -u quailcomp bun install

# Build frontend
echo "Building frontend..."
cd /opt/quailcomp/frontend
sudo -u quailcomp bun run build

# Run migrations
echo "Running migrations..."
cd /opt/quailcomp
sudo -u quailcomp bun run db:migrate

# Start service
echo "Starting service..."
systemctl start quailcomp

# Verify
echo "Verifying deployment..."
sleep 5
systemctl status quailcomp
curl -f http://localhost:3000/health || exit 1

echo "Update complete!"
```

Make executable:

```bash
sudo chmod +x /opt/quailcomp/update.sh
```

Run updates:

```bash
sudo /opt/quailcomp/update.sh
```

## Troubleshooting

### Service Won't Start

**Check logs:**

```bash
sudo journalctl -u quailcomp -n 100 --no-pager
```

**Common issues:**

1. **Port already in use:**

```bash
sudo lsof -i :3000
# Kill conflicting process if found
sudo kill -9 <PID>
```

2. **Database connection failed:**

Check DATABASE_URL in `.env`:

```bash
sudo -u quailcomp cat /opt/quailcomp/.env | grep DATABASE_URL
```

Test database connection:

```bash
sudo -u quailcomp psql -U quailcomp_app -d quailcomp -h localhost -c "SELECT 1;"
```

3. **Permission errors:**

```bash
# Fix ownership
sudo chown -R quailcomp:quailcomp /opt/quailcomp

# Fix .env permissions
sudo chmod 600 /opt/quailcomp/.env
```

4. **Missing dependencies:**

```bash
cd /opt/quailcomp
sudo -u quailcomp bun install
```

### High Memory Usage

Check current usage:

```bash
systemctl status quailcomp
```

View detailed memory info:

```bash
sudo systemd-cgtop
```

Adjust memory limit in `/etc/systemd/system/quailcomp.service`:

```ini
[Service]
MemoryMax=2G
MemoryHigh=1.5G
```

Reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart quailcomp
```

### Database Connection Pool Exhausted

**Symptoms:**

- Errors: "connection pool exhausted"
- Slow API responses
- 500 errors

**Solutions:**

1. **Increase pool size in `.env`:**

```bash
DATABASE_POOL_MAX=20
```

2. **Check for connection leaks:**

```bash
# View active connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='quailcomp';"
```

3. **Restart service:**

```bash
sudo systemctl restart quailcomp
```

### SSL Certificate Issues

**Certificate not found:**

```bash
# List certificates
sudo certbot certificates

# Renew if needed
sudo certbot renew
```

**Certificate expired:**

```bash
# Check expiration
sudo certbot certificates

# Renew
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Application Errors

**View application logs:**

```bash
sudo journalctl -u quailcomp -p err -n 50
```

**Enable debug logging temporarily:**

Edit `/opt/quailcomp/.env`:

```bash
LOG_LEVEL=debug
```

Restart:

```bash
sudo systemctl restart quailcomp
```

Remember to set back to `info` after debugging.

## Security Hardening

### Firewall Configuration

Install and configure UFW (Uncomplicated Firewall):

```bash
sudo apt install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if using non-standard)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### SSH Hardening

Edit `/etc/ssh/sshd_config`:

```bash
# Disable root login
PermitRootLogin no

# Disable password authentication (use keys only)
PasswordAuthentication no
PubkeyAuthentication yes

# Change default port (optional)
# Port 2222

# Limit authentication attempts
MaxAuthTries 3

# Disable empty passwords
PermitEmptyPasswords no
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

### Install Fail2ban

Protect against brute force attacks:

```bash
sudo apt install -y fail2ban

# Create local configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

Edit `/etc/fail2ban/jail.local`:

```ini
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
maxretry = 3
```

Start fail2ban:

```bash
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### Automatic Security Updates

Install unattended-upgrades:

```bash
sudo apt install -y unattended-upgrades

# Enable automatic updates
sudo dpkg-reconfigure -plow unattended-upgrades
```

Configure in `/etc/apt/apt.conf.d/50unattended-upgrades`:

```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};

Unattended-Upgrade::Automatic-Reboot "false";
```

### File Permissions Audit

Ensure correct permissions:

```bash
# Application directory
sudo chown -R quailcomp:quailcomp /opt/quailcomp
sudo chmod -R 755 /opt/quailcomp

# Environment file (contains secrets)
sudo chmod 600 /opt/quailcomp/.env
sudo chown quailcomp:quailcomp /opt/quailcomp/.env

# Log directory
sudo chown -R quailcomp:quailcomp /var/log/quailcomp
sudo chmod -R 755 /var/log/quailcomp

# Systemd service file
sudo chmod 644 /etc/systemd/system/quailcomp.service
```

### Security Checklist

- [ ] Firewall configured (UFW or iptables)
- [ ] SSH hardened (key-only auth, non-root)
- [ ] Fail2ban installed and configured
- [ ] SSL certificate installed and auto-renewal working
- [ ] Database uses strong passwords
- [ ] `.env` file has 600 permissions
- [ ] Automatic security updates enabled
- [ ] Regular backups configured
- [ ] Monitoring and alerting set up
- [ ] Application logs reviewed regularly
- [ ] PostgreSQL exposed only to localhost
- [ ] Nginx security headers configured
- [ ] HSTS enabled
- [ ] Rate limiting configured

## Related Documentation

- [Deployment README](../../deployment/README.md) - Quick deployment reference
- [Backup and Restore Guide](./backup-restore-production.md) - Backup procedures
- [Database Roles](../explanation/database-roles.md) - Understanding database users
- [Environment Variables](../reference/environment-variables.md) - Configuration reference
- [Development Setup](./setup-development.md) - Local development

## Support

For issues and questions:

- GitHub Issues: <https://github.com/yourusername/quailcomp/issues>
- Documentation: [docs/](../../docs/)
