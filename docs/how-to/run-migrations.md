# How to Run Migrations

This guide covers creating and running database migrations in Quailcomp.

## Quick Reference

| Command | Description |
|---------|-------------|
| `bun run db:migrate` | Run pending migrations on development database |
| `bun run scripts/rollback-migration.ts 003` | Rollback a specific migration |
| `bun run scripts/rollback-migration.ts all` | Rollback all migrations |
| `./data/postgres/migrations/run.sh` | Run migrations directly |
| `./data/postgres/migrations/verify.sh` | Verify migration status |

## Running Migrations

### Development Database

```bash
bun run db:migrate
```

This executes `data/postgres/migrations/run.sh`, which:

1. Scans for files matching `[0-9][0-9][0-9]_*.sql`
2. Checks `schema_migrations` table for already-applied versions
3. Applies new migrations in order
4. Records version, timestamp, and checksum

### Test Database

Test migrations are handled automatically by the test runner. You don't need to run them manually.

See [How to Run Tests](run-tests.md#test-database) for details.

## Creating a New Migration

### 1. Determine the Next Number

```bash
ls -1 data/postgres/migrations/[0-9][0-9][0-9]_*.sql | tail -1
# If last is 002_auth_tables.sql, create 003_...
```

### 2. Create the File

```bash
touch data/postgres/migrations/003_your_description.sql
```

**Naming convention:** `NNN_description_with_underscores.sql`

- `NNN`: Zero-padded sequential number (000, 001, 002)
- Description: Lowercase with underscores
- Extension: Always `.sql`

### 3. Write Idempotent SQL

All migrations must be **idempotent** - safe to run multiple times without errors.

```sql
-- 003_add_metadata_column.sql

-- Tables: use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS new_table (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes: use IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table (name);

-- Columns: check before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'entities' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE entities ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE new_table IS 'Description of table purpose';
```

### 4. Test Idempotency

Before committing, verify the migration can run twice:

```bash
# Run migration
psql -f data/postgres/migrations/003_your_description.sql

# Run again - should not error
psql -f data/postgres/migrations/003_your_description.sql
```

### 5. Apply to Development

```bash
bun run db:migrate
```

## Idempotent Patterns

Use these patterns to ensure migrations are safe to re-run:

| Object | Pattern |
|--------|---------|
| Tables | `CREATE TABLE IF NOT EXISTS` |
| Indexes | `CREATE INDEX IF NOT EXISTS` |
| Sequences | `CREATE SEQUENCE IF NOT EXISTS` |
| Functions | `CREATE OR REPLACE FUNCTION` |
| Views | `CREATE OR REPLACE VIEW` |
| Roles | `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` |

**Avoid:**

- Plain `CREATE TABLE` without `IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN` without checking existence
- `DROP` statements (use soft deletes instead)

## Migration Tracking

Migrations are tracked in the `schema_migrations` table:

| Column | Description |
|--------|-------------|
| `version` | Migration filename without `.sql` |
| `applied_at` | When the migration was executed |
| `checksum` | SHA256 hash of file contents |
| `execution_time_ms` | How long it took |

### Check Status

```bash
# List applied migrations
psql -c "SELECT version, applied_at FROM schema_migrations ORDER BY version"

# Verify all migrations
./data/postgres/migrations/verify.sh
```

## Rules

- **Never modify existing migrations** - checksums are tracked and changes will be flagged
- **Migrations run as `quailcomp_owner`** - see [Database Roles](../explanation/database-roles.md)
- **Test idempotency** - run twice locally before committing
- **Keep migrations small** - one logical change per migration
- **Add comments** - explain why, not just what

## Troubleshooting

### Migration Fails with "Relation Already Exists"

Your migration is not idempotent. Add `IF NOT EXISTS`:

```sql
-- Bad
CREATE TABLE users (...);

-- Good
CREATE TABLE IF NOT EXISTS users (...);
```

### Checksum Mismatch Warning

A migration file was modified after being applied. Options:

1. **If accidental:** Revert to the original file
2. **If correction needed:** Create a new migration instead

Never modify an already-applied migration.

### Permission Denied

Ensure your connection user has sufficient privileges. Migrations run as `quailcomp_owner`.

See [Development Setup](setup-development.md#database-setup) for role configuration.

### Database Doesn't Exist

Run setup first:

```bash
cd data/postgres/setup
./run.sh
```

## Rolling Back Migrations

Down migrations allow you to undo schema changes. Each migration has a corresponding `*_down.sql` file.

### Rollback a Specific Migration

```bash
# Rollback migration 003
bun run scripts/rollback-migration.ts 003
```

### Rollback All Migrations

```bash
# Rollback all migrations in reverse order
bun run scripts/rollback-migration.ts all
```

### Warning: Data Loss

**Rolling back migrations will DELETE DATA:**

- Migration 001 down: Deletes all entities and events
- Migration 002 down: Deletes all users and permissions
- Migration 003 down: Only removes indexes (safe)

Always backup your database before rolling back:

```bash
pg_dump quailcomp > backup.sql
```

### Creating Down Migrations

When creating a new migration, also create a down migration:

```bash
# Create up migration
touch data/postgres/migrations/004_add_feature.sql

# Create down migration
touch data/postgres/migrations/004_add_feature_down.sql
```

Down migrations should:

- Reverse all changes from the up migration
- Drop tables/indexes in reverse order
- Handle dependencies (CASCADE where needed)
- Document any data loss warnings

## Related

- [Development Setup](setup-development.md) - Initial database setup
- [Database Roles](../explanation/database-roles.md) - Why `quailcomp_owner` vs `quailcomp_app`
- [Backup and Restore](backup-restore-database.md) - Before major migrations
