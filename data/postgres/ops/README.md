# Database Operations

This directory contains operational scripts for backing up and restoring the quailcomp PostgreSQL database.

## Overview

The operations scripts provide simple, reliable tools for:
- Creating consistent database backups
- Restoring from backup files
- Disaster recovery and data migration

## Scripts

### [backup.sh](backup.sh) - Create Database Backup

Creates a timestamped backup of the entire `quailcomp` database in PostgreSQL's custom format.

**Features:**
- Automatic timestamping (`quailcomp_YYYYMMDD_HHMMSS.dump`)
- Custom format for efficient compression and flexibility
- Backups stored in `backups/` subdirectory
- Full database dump including schema and data

**Usage:**

```bash
./db/ops/backup.sh
```

**Output:**

```
Creating backup: quailcomp_20260119_143022.dump
Backup completed:
  /Users/you/quailcomp/db/ops/backups/quailcomp_20260119_143022.dump
```

**What's Backed Up:**
- All tables and data
- All schemas
- All sequences and their current values
- All indexes
- All constraints and triggers
- Object ownership and privileges (grants)

**What's NOT Backed Up:**
- Roles (these are cluster-wide, not database-specific)
- Passwords
- Database creation itself (only contents)

### [restore.sh](restore.sh) - Restore from Backup

Restores a database from a backup file created by [backup.sh](backup.sh).

**Features:**
- Requires explicit confirmation to prevent accidents
- Cleans existing objects before restore (`--clean`)
- Uses `--if-exists` to avoid errors if objects don't exist
- Overwrites existing data in the target database

**Usage:**

```bash
./db/ops/restore.sh path/to/backup.dump
```

**Example:**

```bash
./db/ops/restore.sh backups/quailcomp_20260119_143022.dump
```

**Interactive Prompt:**

```
⚠️ RESTORE WARNING ⚠️
This will overwrite data in the quailcomp database
Type 'RESTORE quailcomp' to continue: RESTORE quailcomp
```

**Behavior:**
- Drops existing tables, sequences, and other objects
- Recreates schema from backup
- Restores all data
- Restores object ownership and privileges

## Environment Configuration

Both scripts use standard PostgreSQL environment variables. You can set these:

1. **In your shell**:
   ```bash
   export PGHOST=localhost
   export PGPORT=5432
   export PGUSER=postgres
   export PGPASSWORD=your_password
   export PGDATABASE=quailcomp
   ```

2. **Via command line** (for single command):
   ```bash
   PGHOST=localhost PGPORT=5432 PGUSER=postgres ./db/ops/backup.sh
   ```

3. **Via `.pgpass` file** (recommended for passwords):
   ```bash
   # ~/.pgpass format: hostname:port:database:username:password
   localhost:5432:quailcomp:postgres:your_password
   ```
   Then `chmod 600 ~/.pgpass`

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PGHOST` | Database host | `localhost` |
| `PGPORT` | Database port | `5432` |
| `PGUSER` | Database user with backup/restore permissions | `postgres` |
| `PGDATABASE` | Target database name | `quailcomp` |
| `PGPASSWORD` | Password (optional if using `.pgpass`) | `your_password` |

## Backup Format

Backups use PostgreSQL's **custom format** (`--format=custom`), which provides:

- **Compression**: Smaller file sizes
- **Flexibility**: Selective restore of specific tables/schemas
- **Parallel restore**: Can use `-j` flag for faster restoration
- **Reliability**: Built-in integrity checks

Custom format backups are **binary** and can only be restored with `pg_restore` (not `psql`).

## Common Workflows

### Regular Backup Routine

```bash
# Daily backup
./db/ops/backup.sh

# Keep last 7 days, delete older backups
find ./db/ops/backups -name "*.dump" -mtime +7 -delete
```

### Disaster Recovery

```bash
# 1. Ensure database exists (run setup if needed)
./db/setup/run.sh

# 2. Restore from most recent backup
./db/ops/restore.sh backups/quailcomp_20260119_143022.dump
```

### Migrate to New Environment

```bash
# On source environment
./db/ops/backup.sh

# Copy backup file to target environment
scp backups/quailcomp_20260119_143022.dump user@target:/path/to/quailcomp/db/ops/backups/

# On target environment
./db/setup/run.sh                                    # Create database structure
./db/ops/restore.sh backups/quailcomp_20260119_143022.dump  # Restore data
```

### Test Restore (Verify Backups Work)

```bash
# 1. Create test database
createdb quailcomp_test

# 2. Restore to test database
PGDATABASE=quailcomp_test ./db/ops/restore.sh backups/quailcomp_20260119_143022.dump

# 3. Verify data
psql quailcomp_test -c "SELECT COUNT(*) FROM your_table;"

# 4. Clean up
dropdb quailcomp_test
```

## Permissions Required

### For Backups ([backup.sh](backup.sh))

The database user must have:
- CONNECT privilege on the database
- SELECT privilege on all tables
- USAGE privilege on all schemas

Typically: `postgres` superuser or `quailcomp_owner` role.

### For Restores ([restore.sh](restore.sh))

The database user must have:
- CONNECT privilege on the database
- CREATE privilege on the database
- Ability to drop and create objects
- Ability to set ownership (usually requires superuser)

Typically: `postgres` superuser.

**Important**: Do NOT restore as `quailcomp_app` - this role has limited privileges and cannot create objects.

## Backup Storage Recommendations

### Local Development

Backups are stored in [backups/](backups/) (gitignored):
- Convenient for quick local backups
- Not suitable for production (stored on same machine)

### Production

Store backups externally:
- Cloud storage (S3, GCS, Azure Blob Storage)
- Separate backup server
- Managed backup service

Example with S3:
```bash
./db/ops/backup.sh
aws s3 cp backups/quailcomp_*.dump s3://your-bucket/db-backups/
```

## Troubleshooting

### "role does not exist" During Restore

If you see errors about missing roles during restore:

```bash
# Create roles first (run setup)
./db/setup/run.sh

# Then restore
./db/ops/restore.sh backups/your_backup.dump
```

### Permission Denied

Ensure your `PGUSER` has sufficient privileges (see Permissions Required section above).

### Out of Disk Space

Custom format backups are compressed, but large databases still require significant space. Monitor:

```bash
# Check backup size
du -sh backups/

# Check available disk space
df -h
```

## Safety Notes

- **Backups are not tested until restored** - Periodically test your backups
- **Restore overwrites data** - Always confirm you're restoring to the correct database
- **No encryption by default** - Encrypt sensitive backups or store in encrypted locations
- **Backups contain all data** - Treat backup files as sensitive as your production database
- **The `backups/` directory is gitignored** - Never commit backup files to source control

## Related Documentation

- [Database Setup](../setup/README.md) - Initial database provisioning
- [Database Teardown](../teardown/README.md) - Complete database removal
