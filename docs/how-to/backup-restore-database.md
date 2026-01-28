# How to Backup and Restore the Database

This guide covers backing up and restoring the Quailcomp database.

## Quick Reference

| Command | Description |
|---------|-------------|
| `./data/postgres/ops/backup.sh` | Create timestamped backup |
| `./data/postgres/ops/restore.sh <file>` | Restore from backup |

## Creating Backups

### Run the Backup Script

```bash
./data/postgres/ops/backup.sh
```

This creates a timestamped backup in `data/postgres/ops/backups/`:

```
Creating backup: quailcomp_20260128_143022.dump
Backup completed:
  /Users/you/quailcomp/data/postgres/ops/backups/quailcomp_20260128_143022.dump
```

### What's Backed Up

- All tables and data
- All schemas
- All sequences and current values
- All indexes, constraints, triggers
- Object ownership and privileges

### What's NOT Backed Up

- Roles (cluster-wide, not database-specific)
- Passwords
- Other databases

### Backup Format

Backups use PostgreSQL's **custom format** (`pg_dump --format=custom`):

- Compressed for smaller file sizes
- Supports selective restore
- Can only be restored with `pg_restore`

## Restoring from Backup

### Prerequisites

Ensure the database and roles exist:

```bash
# If starting fresh, run setup first
cd data/postgres/setup
./run.sh
```

### Run the Restore Script

```bash
./data/postgres/ops/restore.sh data/postgres/ops/backups/quailcomp_20260128_143022.dump
```

### Confirmation Required

Restore requires explicit confirmation to prevent accidents:

```
WARNING: This will overwrite data in the quailcomp database
Type 'RESTORE quailcomp' to continue: RESTORE quailcomp
```

### What Restore Does

1. Drops existing tables, sequences, and objects
2. Recreates schema from backup
3. Restores all data
4. Restores ownership and privileges

## Environment Configuration

Set these variables for the backup/restore scripts:

```bash
export PGHOST=localhost
export PGPORT=5432
export PGUSER=postgres
export PGPASSWORD=your_password
export PGDATABASE=quailcomp
```

Or use a `.pgpass` file (recommended for passwords):

```bash
# ~/.pgpass format: hostname:port:database:username:password
localhost:5432:quailcomp:postgres:your_password
```

```bash
chmod 600 ~/.pgpass
```

## Common Workflows

### Regular Backup Routine

```bash
# Daily backup
./data/postgres/ops/backup.sh

# Keep last 7 days, delete older
find ./data/postgres/ops/backups -name "*.dump" -mtime +7 -delete
```

### Before Major Changes

```bash
# Backup before running migrations
./data/postgres/ops/backup.sh

# Run migrations
bun run db:migrate

# If something goes wrong, restore
./data/postgres/ops/restore.sh data/postgres/ops/backups/quailcomp_YYYYMMDD_HHMMSS.dump
```

### Clean Development Reset

```bash
# Backup current state
./data/postgres/ops/backup.sh

# Teardown everything
./data/postgres/teardown/run.sh

# Setup fresh
./data/postgres/setup/run.sh

# Run migrations
bun run db:migrate
```

### Test Backup Integrity

```bash
# Create test database
createdb quailcomp_test_restore

# Restore to test database
PGDATABASE=quailcomp_test_restore ./data/postgres/ops/restore.sh \
  data/postgres/ops/backups/quailcomp_20260128_143022.dump

# Verify data
psql quailcomp_test_restore -c "SELECT COUNT(*) FROM entities;"

# Clean up
dropdb quailcomp_test_restore
```

### Migrate to New Environment

```bash
# On source environment
./data/postgres/ops/backup.sh

# Copy backup to target
scp data/postgres/ops/backups/quailcomp_*.dump user@target:/path/to/quailcomp/data/postgres/ops/backups/

# On target environment
./data/postgres/setup/run.sh
./data/postgres/ops/restore.sh data/postgres/ops/backups/quailcomp_*.dump
```

## Permissions

### For Backups

The user needs:

- CONNECT privilege on database
- SELECT privilege on all tables
- USAGE privilege on all schemas

Use `postgres` superuser or `quailcomp_owner`.

### For Restores

The user needs:

- CONNECT and CREATE privileges
- Ability to drop and create objects
- Ability to set ownership (usually requires superuser)

**Do NOT restore as `quailcomp_app`** - it has limited privileges.

## Storage Recommendations

### Local Development

Backups in `data/postgres/ops/backups/` are gitignored. Fine for local use but not for production.

### Production

Store backups externally:

- Cloud storage (S3, GCS, Azure Blob)
- Separate backup server
- Managed backup service

Example with S3:

```bash
./data/postgres/ops/backup.sh
aws s3 cp data/postgres/ops/backups/quailcomp_*.dump s3://your-bucket/db-backups/
```

## Troubleshooting

### "Role Does Not Exist" During Restore

Roles must exist before restoring:

```bash
# Run setup first
./data/postgres/setup/run.sh

# Then restore
./data/postgres/ops/restore.sh <backup-file>
```

### Permission Denied

Ensure your PGUSER has sufficient privileges. See [Permissions](#permissions) above.

### Out of Disk Space

Custom format is compressed, but large databases need significant space:

```bash
# Check backup size
du -sh data/postgres/ops/backups/

# Check available space
df -h
```

### Backup File Not Found

Backups are in `data/postgres/ops/backups/`. List available backups:

```bash
ls -la data/postgres/ops/backups/
```

## Safety Notes

- **Test your backups** - A backup isn't verified until restored
- **Restore overwrites data** - Always confirm you're restoring to the correct database
- **No encryption by default** - Encrypt sensitive backups or store in encrypted locations
- **Treat backups as sensitive** - They contain all your data
- **Backups are gitignored** - Never commit backup files

## Related

- [Development Setup](setup-development.md) - Database setup
- [Run Migrations](run-migrations.md) - After restoring, verify migrations
- [Database Roles](../explanation/database-roles.md) - Permission model
