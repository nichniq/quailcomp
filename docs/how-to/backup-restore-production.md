# Backup and Restore Guide

This guide covers backup and restore procedures for Quailcomp in production environments.

## Table of Contents

- [Overview](#overview)
- [Automated Backups](#automated-backups)
- [Manual Backups](#manual-backups)
- [Restore Procedures](#restore-procedures)
- [Backup Verification](#backup-verification)
- [Off-Site Backups](#off-site-backups)
- [Disaster Recovery](#disaster-recovery)

## Overview

### What Gets Backed Up

Quailcomp backups include:
- **PostgreSQL database** - All application data (entities, events, access control)
- **Environment configuration** - `.env` file (optional, contains secrets)
- **Application files** - Source code and frontend builds (optional, can be restored from git)

### Backup Strategy

Recommended backup approach:
- **Database**: Daily automated backups with 30-day retention
- **Configuration**: Manual backups when changed
- **Application files**: Not needed (restore from git repository)

### Backup Location

Default backup directory: `/var/backups/quailcomp/`

Contents:
```
/var/backups/quailcomp/
├── quailcomp-20260201-120000.sql.gz
├── quailcomp-20260202-120000.sql.gz
├── quailcomp-20260203-120000.sql.gz
└── backup.log
```

## Automated Backups

### Using the Backup Script

The backup script is located at `/opt/quailcomp/deployment/backup.sh`.

**Features:**
- Creates compressed PostgreSQL dumps (`.sql.gz`)
- Automatic retention (default: 30 days)
- Logging to `backup.log`
- Database connection testing
- Error handling and validation

### Manual Execution

Run the backup script manually:

```bash
sudo -u quailcomp /opt/quailcomp/deployment/backup.sh
```

Output:
```
=========================================
Quailcomp Database Backup
=========================================
Timestamp: 20260201-120000
Database: quailcomp
Backup file: /var/backups/quailcomp/quailcomp-20260201-120000.sql.gz
Retention: 30 days

✓ Database connection successful
✓ Backup created successfully
✓ Backup size: 2.34 MB
✓ Backup permissions set to 640
✓ Deleted 2 old backup(s)

Backup completed successfully!
=========================================
```

### Custom Backup Directory

Specify a different backup directory:

```bash
sudo -u quailcomp /opt/quailcomp/deployment/backup.sh /custom/backup/path
```

Or set via environment variable:

```bash
BACKUP_DIR=/custom/backup/path sudo -u quailcomp /opt/quailcomp/deployment/backup.sh
```

### Configuration Options

Environment variables for backup script:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DIR` | `/var/backups/quailcomp` | Backup storage directory |
| `BACKUP_RETENTION` | `30` | Days to retain backups |
| `DATABASE_NAME` | `quailcomp` | Database name |
| `PGUSER` | `quailcomp_owner` | PostgreSQL user |
| `PGPASSWORD` | (from .env) | PostgreSQL password |

Example with custom settings:

```bash
BACKUP_RETENTION=90 \
DATABASE_NAME=quailcomp \
sudo -u quailcomp /opt/quailcomp/deployment/backup.sh
```

### Scheduled Backups with Cron

Set up daily automated backups using cron.

**Edit crontab for quailcomp user:**

```bash
sudo crontab -u quailcomp -e
```

**Add daily backup at 2 AM:**

```cron
# Daily backup at 2:00 AM
0 2 * * * /opt/quailcomp/deployment/backup.sh >> /var/log/quailcomp/backup-cron.log 2>&1
```

**Multiple daily backups:**

```cron
# Backup every 6 hours
0 */6 * * * /opt/quailcomp/deployment/backup.sh >> /var/log/quailcomp/backup-cron.log 2>&1
```

**Weekly backup with longer retention:**

```cron
# Daily backup (30 day retention)
0 2 * * * /opt/quailcomp/deployment/backup.sh >> /var/log/quailcomp/backup-cron.log 2>&1

# Weekly backup (90 day retention) - Sunday at 3 AM
0 3 * * 0 BACKUP_DIR=/var/backups/quailcomp/weekly BACKUP_RETENTION=90 /opt/quailcomp/deployment/backup.sh >> /var/log/quailcomp/backup-weekly.log 2>&1
```

**Verify cron job is scheduled:**

```bash
sudo crontab -u quailcomp -l
```

### Email Notifications

Set up email alerts for backup failures.

**Install mail utilities:**

```bash
sudo apt install -y mailutils
```

**Create wrapper script** `/opt/quailcomp/deployment/backup-with-email.sh`:

```bash
#!/bin/bash
BACKUP_SCRIPT="/opt/quailcomp/deployment/backup.sh"
ADMIN_EMAIL="admin@yourdomain.com"
LOG_FILE="/var/log/quailcomp/backup-cron.log"

# Run backup and capture output
if "${BACKUP_SCRIPT}" >> "${LOG_FILE}" 2>&1; then
    echo "Backup completed successfully at $(date)" | \
        mail -s "Quailcomp Backup Success" "${ADMIN_EMAIL}"
else
    echo "Backup failed at $(date). Check logs at ${LOG_FILE}" | \
        mail -s "ALERT: Quailcomp Backup Failed" "${ADMIN_EMAIL}"
    exit 1
fi
```

Make executable:

```bash
sudo chmod +x /opt/quailcomp/deployment/backup-with-email.sh
```

Update crontab to use wrapper:

```cron
0 2 * * * /opt/quailcomp/deployment/backup-with-email.sh
```

## Manual Backups

### Database-Only Backup

Quick database backup without using the script:

```bash
sudo -u quailcomp pg_dump -U quailcomp_owner -h localhost quailcomp | \
    gzip > ~/quailcomp-manual-$(date +%Y%m%d-%H%M%S).sql.gz
```

### Backup with Custom pg_dump Options

More control over backup format:

```bash
# Plain SQL format (default)
sudo -u quailcomp pg_dump \
    -U quailcomp_owner \
    -h localhost \
    -d quailcomp \
    --format=plain \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | gzip > backup.sql.gz

# Custom format (smaller, faster restore)
sudo -u quailcomp pg_dump \
    -U quailcomp_owner \
    -h localhost \
    -d quailcomp \
    --format=custom \
    --compress=9 \
    --file=backup.dump

# Directory format (parallel dump/restore)
sudo -u quailcomp pg_dump \
    -U quailcomp_owner \
    -h localhost \
    -d quailcomp \
    --format=directory \
    --jobs=4 \
    --file=backup_dir/
```

### Backup Configuration Files

Backup the `.env` file (contains secrets):

```bash
# Backup .env to secure location
sudo cp /opt/quailcomp/.env /var/backups/quailcomp/env-backup-$(date +%Y%m%d).txt
sudo chmod 600 /var/backups/quailcomp/env-backup-*.txt
```

**Security Note:** The `.env` file contains sensitive information (passwords, JWT secrets). Store backups securely and restrict access.

### Full Application Backup

Backup entire application directory (useful before updates):

```bash
sudo tar -czf \
    /var/backups/quailcomp/app-backup-$(date +%Y%m%d).tar.gz \
    -C /opt/quailcomp \
    --exclude=node_modules \
    --exclude=.git \
    .
```

## Restore Procedures

### Prerequisites

Before restoring:
1. Stop the application: `sudo systemctl stop quailcomp`
2. Ensure PostgreSQL is running: `sudo systemctl status postgresql`
3. Have a valid backup file

### Basic Database Restore

Restore from a compressed SQL backup:

```bash
# Stop application
sudo systemctl stop quailcomp

# Restore database
gunzip < /var/backups/quailcomp/quailcomp-20260201-120000.sql.gz | \
    sudo -u postgres psql -d quailcomp

# Start application
sudo systemctl start quailcomp
```

### Complete Database Restoration

For a complete restore (drop and recreate database):

```bash
# Stop application
sudo systemctl stop quailcomp

# Drop and recreate database
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS quailcomp;
CREATE DATABASE quailcomp OWNER quailcomp_owner;
EOF

# Restore from backup
gunzip < /var/backups/quailcomp/quailcomp-20260201-120000.sql.gz | \
    sudo -u postgres psql -d quailcomp

# Grant permissions to app user
sudo -u postgres psql -d quailcomp << EOF
GRANT USAGE ON SCHEMA public TO quailcomp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO quailcomp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO quailcomp_app;
EOF

# Start application
sudo systemctl start quailcomp

# Verify
curl http://localhost:3000/health
```

### Restore from Custom Format Backup

If using custom format backups:

```bash
sudo systemctl stop quailcomp

sudo -u postgres pg_restore \
    --clean \
    --if-exists \
    --dbname=quailcomp \
    /var/backups/quailcomp/backup.dump

sudo systemctl start quailcomp
```

### Restore from Directory Format

If using directory format backups:

```bash
sudo systemctl stop quailcomp

sudo -u postgres pg_restore \
    --clean \
    --if-exists \
    --dbname=quailcomp \
    --jobs=4 \
    /var/backups/quailcomp/backup_dir/

sudo systemctl start quailcomp
```

### Point-in-Time Recovery

If PostgreSQL WAL archiving is enabled, perform point-in-time recovery:

**1. Stop PostgreSQL:**

```bash
sudo systemctl stop postgresql
```

**2. Restore base backup:**

```bash
sudo rm -rf /var/lib/postgresql/16/main/*
sudo -u postgres tar -xzf /var/backups/postgres/base.tar.gz -C /var/lib/postgresql/16/main/
```

**3. Create recovery configuration:**

```bash
sudo -u postgres cat > /var/lib/postgresql/16/main/recovery.conf << EOF
restore_command = 'cp /var/backups/postgres/wal/%f %p'
recovery_target_time = '2026-02-01 12:00:00'
EOF
```

**4. Start PostgreSQL:**

```bash
sudo systemctl start postgresql
```

**Note:** Point-in-time recovery requires WAL archiving to be configured. This is an advanced feature not covered in basic deployment.

### Restore Configuration

Restore the `.env` file:

```bash
sudo cp /var/backups/quailcomp/env-backup-20260201.txt /opt/quailcomp/.env
sudo chmod 600 /opt/quailcomp/.env
sudo chown quailcomp:quailcomp /opt/quailcomp/.env
```

## Backup Verification

### Verify Backup File Integrity

Check backup file exists and is not corrupted:

```bash
# Check file exists
ls -lh /var/backups/quailcomp/quailcomp-*.sql.gz

# Test gzip integrity
gunzip -t /var/backups/quailcomp/quailcomp-20260201-120000.sql.gz
echo $?  # Should output 0 if valid
```

### Test Restore to Temporary Database

Verify backup can be restored successfully:

```bash
# Create temporary database
sudo -u postgres psql << EOF
CREATE DATABASE quailcomp_test OWNER quailcomp_owner;
EOF

# Restore backup
gunzip < /var/backups/quailcomp/quailcomp-20260201-120000.sql.gz | \
    sudo -u postgres psql -d quailcomp_test

# Verify tables exist
sudo -u postgres psql -d quailcomp_test -c "\dt"

# Check row counts
sudo -u postgres psql -d quailcomp_test << EOF
SELECT 'entities' as table, COUNT(*) FROM entities
UNION ALL
SELECT 'events', COUNT(*) FROM events;
EOF

# Drop test database
sudo -u postgres psql << EOF
DROP DATABASE quailcomp_test;
EOF
```

### Automated Backup Testing

Create a script to verify backups weekly:

`/opt/quailcomp/deployment/verify-backup.sh`:

```bash
#!/bin/bash
set -e

LATEST_BACKUP=$(ls -t /var/backups/quailcomp/quailcomp-*.sql.gz | head -1)

echo "Verifying backup: ${LATEST_BACKUP}"

# Test gzip integrity
gunzip -t "${LATEST_BACKUP}"

# Test restore to temp database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS quailcomp_verify;"
sudo -u postgres psql -c "CREATE DATABASE quailcomp_verify OWNER quailcomp_owner;"
gunzip < "${LATEST_BACKUP}" | sudo -u postgres psql -d quailcomp_verify > /dev/null

# Check tables exist
TABLE_COUNT=$(sudo -u postgres psql -d quailcomp_verify -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

if [ "${TABLE_COUNT}" -lt 3 ]; then
    echo "ERROR: Backup verification failed - insufficient tables"
    exit 1
fi

# Cleanup
sudo -u postgres psql -c "DROP DATABASE quailcomp_verify;"

echo "Backup verification successful!"
```

Schedule weekly:

```cron
0 4 * * 0 /opt/quailcomp/deployment/verify-backup.sh >> /var/log/quailcomp/backup-verify.log 2>&1
```

## Off-Site Backups

### Rsync to Remote Server

Copy backups to a remote server using rsync:

```bash
# Install rsync
sudo apt install -y rsync

# Sync to remote server
rsync -avz --delete \
    /var/backups/quailcomp/ \
    backup-user@backup-server.com:/backups/quailcomp/
```

**Automated with cron:**

```bash
# Setup SSH keys first
sudo -u quailcomp ssh-keygen -t ed25519
sudo -u quailcomp ssh-copy-id backup-user@backup-server.com

# Add to crontab
0 3 * * * rsync -avz --delete /var/backups/quailcomp/ backup-user@backup-server.com:/backups/quailcomp/ >> /var/log/quailcomp/rsync.log 2>&1
```

### AWS S3 Backup

Upload backups to AWS S3:

**Install AWS CLI:**

```bash
sudo apt install -y awscli
```

**Configure credentials:**

```bash
sudo -u quailcomp aws configure
```

**Create S3 sync script** `/opt/quailcomp/deployment/s3-backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/quailcomp"
S3_BUCKET="s3://your-backup-bucket/quailcomp/"

# Sync to S3
aws s3 sync "${BACKUP_DIR}" "${S3_BUCKET}" \
    --exclude "*.log" \
    --storage-class STANDARD_IA

# Delete backups older than 90 days from S3
aws s3 ls "${S3_BUCKET}" | \
    awk '{print $4}' | \
    while read -r file; do
        file_date=$(echo "$file" | grep -oP '\d{8}')
        if [ -n "$file_date" ]; then
            days_old=$(( ($(date +%s) - $(date -d "$file_date" +%s)) / 86400 ))
            if [ "$days_old" -gt 90 ]; then
                aws s3 rm "${S3_BUCKET}${file}"
            fi
        fi
    done

echo "S3 backup completed"
```

**Schedule daily:**

```cron
0 4 * * * /opt/quailcomp/deployment/s3-backup.sh >> /var/log/quailcomp/s3-backup.log 2>&1
```

### Encrypted Off-Site Backups

Encrypt backups before uploading:

```bash
# Encrypt with GPG
gpg --symmetric --cipher-algo AES256 \
    /var/backups/quailcomp/quailcomp-20260201-120000.sql.gz

# Upload encrypted file
rsync -avz \
    /var/backups/quailcomp/quailcomp-20260201-120000.sql.gz.gpg \
    backup-server:/backups/

# Restore: decrypt first
gpg --decrypt quailcomp-20260201-120000.sql.gz.gpg > quailcomp-20260201-120000.sql.gz
```

## Disaster Recovery

### Full System Recovery

Complete recovery procedure from scratch:

**1. Provision new server**
- Follow [Production Deployment Guide](./deploy-production.md)
- Install Bun, PostgreSQL, Nginx

**2. Restore application code**

```bash
cd /opt
sudo git clone https://github.com/yourusername/quailcomp.git
sudo chown -R quailcomp:quailcomp /opt/quailcomp
```

**3. Restore configuration**

```bash
# Restore .env from backup
sudo cp /path/to/env-backup.txt /opt/quailcomp/.env
sudo chmod 600 /opt/quailcomp/.env
sudo chown quailcomp:quailcomp /opt/quailcomp/.env
```

**4. Create database**

```bash
sudo -u postgres psql << EOF
CREATE USER quailcomp_owner WITH PASSWORD 'password';
CREATE USER quailcomp_app WITH PASSWORD 'password';
CREATE DATABASE quailcomp OWNER quailcomp_owner;
EOF
```

**5. Restore database backup**

```bash
gunzip < quailcomp-20260201-120000.sql.gz | \
    sudo -u postgres psql -d quailcomp
```

**6. Configure permissions**

```bash
sudo -u postgres psql -d quailcomp << EOF
GRANT USAGE ON SCHEMA public TO quailcomp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO quailcomp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO quailcomp_app;
EOF
```

**7. Install and start**

```bash
cd /opt/quailcomp
sudo -u quailcomp bun install
cd frontend
sudo -u quailcomp bun run build
cd /opt/quailcomp
sudo systemctl start quailcomp
```

**8. Verify**

```bash
curl http://localhost:3000/health
```

### Recovery Time Objective (RTO)

Expected recovery times:
- **Database restore only**: 5-15 minutes (depending on size)
- **Full system recovery**: 30-60 minutes (including server provisioning)
- **From off-site backup**: Add download time

### Recovery Point Objective (RPO)

Data loss windows:
- **Daily backups**: Up to 24 hours of data loss
- **6-hour backups**: Up to 6 hours of data loss
- **Hourly backups**: Up to 1 hour of data loss

## Related Documentation

- [Production Deployment Guide](./deploy-production.md)
- [Deployment README](../../deployment/README.md)
- [Database Roles](../explanation/database-roles.md)

## Backup Checklist

- [ ] Daily automated backups configured
- [ ] Backup script tested and working
- [ ] Backup retention policy set (30+ days)
- [ ] Off-site backup configured
- [ ] Backup verification scheduled
- [ ] Restore procedure documented
- [ ] Restore tested successfully
- [ ] Disaster recovery plan in place
- [ ] Backup monitoring/alerts configured
- [ ] Team trained on restore procedures
