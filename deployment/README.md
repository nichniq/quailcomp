# Quailcomp Deployment Guide

This guide covers deploying Quailcomp to a Linux server using systemd for process management.

## Overview

Quailcomp uses a Docker-free deployment approach with:

- **Runtime**: Bun (no Node.js required)
- **Process Manager**: systemd
- **Database**: PostgreSQL 16
- **Reverse Proxy**: Nginx (optional but recommended)
- **SSL**: Let's Encrypt via certbot

## Prerequisites

### Server Requirements

- Ubuntu 22.04 or 24.04 LTS (Debian-based distro recommended)
- 2GB RAM minimum (4GB recommended)
- 10GB disk space minimum
- Root or sudo access
- PostgreSQL 16 installed
- Bun runtime installed

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify installation:

```bash
bun --version
# Should show v1.3.6 or higher
```

### Install PostgreSQL 16

```bash
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16
```

## Installation

### 1. Clone Repository

```bash
cd /tmp
git clone https://github.com/yourusername/quailcomp.git
cd quailcomp
```

### 2. Run Installation Script

The installation script will:

- Create a `quailcomp` system user
- Install to `/opt/quailcomp`
- Install dependencies
- Build the frontend
- Configure systemd service
- Setup log rotation

```bash
sudo bash deployment/install.sh
```

### 3. Configure Environment

Edit the `.env` file with your database credentials:

```bash
sudo vim /opt/quailcomp/.env
```

Required variables:

```bash
# Database
DATABASE_URL=postgresql://quailcomp_app:yourpassword@localhost:5432/quailcomp

# Server
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=your-long-random-secret-here

# CORS (adjust for your domain)
CORS_ORIGINS=https://yourdomain.com
```

### 4. Setup Database

Create the database and user:

```bash
sudo -u postgres psql << EOF
CREATE USER quailcomp_owner WITH PASSWORD 'owner_password';
CREATE USER quailcomp_app WITH PASSWORD 'app_password';
CREATE DATABASE quailcomp OWNER quailcomp_owner;
EOF
```

Run migrations:

```bash
cd /opt/quailcomp
sudo -u quailcomp bun run db:migrate
```

### 5. Start the Service

```bash
# Start the service
sudo systemctl start quailcomp

# Enable auto-start on boot
sudo systemctl enable quailcomp

# Check status
sudo systemctl status quailcomp
```

## Service Management

### Systemd Commands

```bash
# Start service
sudo systemctl start quailcomp

# Stop service
sudo systemctl stop quailcomp

# Restart service
sudo systemctl restart quailcomp

# View status
sudo systemctl status quailcomp

# Enable auto-start
sudo systemctl enable quailcomp

# Disable auto-start
sudo systemctl disable quailcomp

# Reload after config changes
sudo systemctl reload quailcomp
```

### View Logs

```bash
# Follow logs in real-time
sudo journalctl -u quailcomp -f

# View last 100 lines
sudo journalctl -u quailcomp -n 100

# View logs since today
sudo journalctl -u quailcomp --since today

# View logs for specific time range
sudo journalctl -u quailcomp --since "2026-01-01 00:00:00" --until "2026-01-01 23:59:59"
```

## Nginx Reverse Proxy (Recommended)

### Install Nginx

```bash
sudo apt install -y nginx
```

### Configure Nginx

Create `/etc/nginx/sites-available/quailcomp`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Bun server
    location / {
        proxy_pass http://localhost:3000;
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
    }

    # Don't log health checks
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/quailcomp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt

Install certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain certificate:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

## Updating the Application

### Manual Update

```bash
# Stop service
sudo systemctl stop quailcomp

# Pull latest changes
cd /opt/quailcomp
sudo -u quailcomp git pull

# Install dependencies
sudo -u quailcomp bun install

# Build frontend
cd frontend
sudo -u quailcomp bun run build

# Run migrations
cd /opt/quailcomp
sudo -u quailcomp bun run db:migrate

# Start service
sudo systemctl start quailcomp
```

### Zero-Downtime Update (Advanced)

For production, consider using a blue-green deployment strategy or a process manager that supports rolling restarts.

## Troubleshooting

### Service Won't Start

Check logs:

```bash
sudo journalctl -u quailcomp -n 50
```

Common issues:

1. **Port already in use**: Check if another process is using port 3000

   ```bash
   sudo lsof -i :3000
   ```

2. **Database connection failed**: Verify DATABASE_URL in `.env`

3. **Permission errors**: Ensure quailcomp user owns files

   ```bash
   sudo chown -R quailcomp:quailcomp /opt/quailcomp
   ```

### High Memory Usage

Check current usage:

```bash
systemctl status quailcomp
```

Adjust memory limit in `/etc/systemd/system/quailcomp.service`:

```ini
[Service]
MemoryMax=1G
```

Then reload:

```bash
sudo systemctl daemon-reload
sudo systemctl restart quailcomp
```

### Logs Not Rotating

Verify logrotate configuration:

```bash
cat /etc/logrotate.d/quailcomp
```

Test logrotate manually:

```bash
sudo logrotate -f /etc/logrotate.d/quailcomp
```

### Database Connection Pool Exhausted

Increase pool size in `.env`:

```bash
DATABASE_POOL_MAX=20
```

Restart service:

```bash
sudo systemctl restart quailcomp
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-01T12:00:00.000Z"
}
```

### Metrics Endpoint

```bash
curl http://localhost:3000/metrics
```

Returns Prometheus-format metrics.

### Setup Uptime Monitoring

Consider using services like:

- UptimeRobot
- Pingdom
- StatusCake

Configure to monitor: `https://yourdomain.com/health`

## Backup and Restore

See [deployment/backup.sh](./backup.sh) for automated backup script.

Manual backup:

```bash
# Backup database
sudo -u postgres pg_dump quailcomp | gzip > quailcomp-$(date +%Y%m%d-%H%M%S).sql.gz
```

Manual restore:

```bash
# Restore database
gunzip < quailcomp-20260201-120000.sql.gz | sudo -u postgres psql quailcomp
```

## Security Checklist

- [ ] Firewall configured (allow only 80, 443, 22)
- [ ] SSH key authentication enabled
- [ ] Password authentication disabled
- [ ] Fail2ban installed and configured
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Database has strong passwords
- [ ] `.env` file has restricted permissions (600)
- [ ] Regular security updates applied
- [ ] Logs monitored for suspicious activity

## Performance Tuning

### PostgreSQL

Edit `/etc/postgresql/16/main/postgresql.conf`:

```ini
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB

# Connections
max_connections = 100
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### Nginx

Enable gzip compression in `/etc/nginx/nginx.conf`:

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
```

## Support

For issues and questions:

- GitHub Issues: <https://github.com/yourusername/quailcomp/issues>
- Documentation: [docs/](../docs/)

## Related Documentation

- [Development Setup](../docs/how-to/setup-development.md)
- [Database Roles](../docs/explanation/database-roles.md)
- [Environment Variables](../docs/reference/environment-variables.md)
