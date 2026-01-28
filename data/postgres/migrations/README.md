# Database Migrations

This directory contains SQL migrations for the quailcomp database schema. Migrations are tracked in the `schema_migrations` table and are applied using the migration runner script.

## Quick Start

```bash
# Run all pending migrations
cd data/postgres/migrations
./run.sh

# Verify migration status
./verify.sh
```

## Migration File Conventions

### Naming Pattern

Migration files must follow this naming convention:

```
NNN_description_with_underscores.sql
```

- **NNN**: Zero-padded sequential number (000, 001, 002, ...)
- **Description**: Lowercase with underscores separating words
- **Extension**: Always `.sql`

Examples:

- `001_initial_schema.sql`
- `002_auth_tables.sql`
- `003_add_bookshelf_table.sql`

### File Structure

Each migration file should follow this structure:

```sql
-- ============================================================================
-- Migration NNN: Brief Description
-- ============================================================================
--
-- This migration adds/changes/removes:
-- - Detail 1
-- - Detail 2
--
-- Related documentation: [link if applicable]
-- ============================================================================

-- All DDL must be idempotent
CREATE TABLE IF NOT EXISTS new_table (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table (name);

-- Add comments for documentation
COMMENT ON TABLE new_table IS 'Description of table purpose and usage';
COMMENT ON COLUMN new_table.name IS 'Description of column';
```

### Idempotency Requirements

**All migrations must be idempotent** - safe to run multiple times without errors. Use these patterns:

- `CREATE TABLE IF NOT EXISTS` for tables
- `CREATE INDEX IF NOT EXISTS` for indexes
- `CREATE SEQUENCE IF NOT EXISTS` for sequences
- `CREATE OR REPLACE FUNCTION` for functions
- `CREATE OR REPLACE VIEW` for views
- `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for roles/extensions

**DO NOT:**

- Use plain `CREATE TABLE` without `IF NOT EXISTS`
- Use `ALTER TABLE ADD COLUMN` without checking if column exists
- Use `DROP` statements (use soft deletes instead)

### Testing Idempotency

Before committing a migration, test that it can run twice:

```bash
# Run migration
psql -f data/postgres/migrations/NNN_your_migration.sql

# Run again - should not error
psql -f data/postgres/migrations/NNN_your_migration.sql
```

## Migration Workflow

### Creating a New Migration

1. **Determine the next migration number**:

   ```bash
   ls -1 data/postgres/migrations/[0-9][0-9][0-9]_*.sql | tail -1
   # If last is 002_auth_tables.sql, create 003_...
   ```

2. **Create the migration file**:

   ```bash
   cd data/postgres/migrations
   nano 003_add_feature_name.sql
   ```

3. **Write idempotent SQL** following the conventions above

4. **Test the migration**:

   ```bash
   # Test on development database
   ./run.sh

   # Verify it worked
   ./verify.sh
   ```

5. **Test idempotency**:

   ```bash
   # Run again - should skip with "already applied"
   ./run.sh
   ```

6. **Commit the migration**:

   ```bash
   git add 003_add_feature_name.sql
   git commit -m "Add migration: feature name"
   ```

### Running Migrations

**From anywhere in the project:**

```bash
bun run db:migrate
```

**Directly:**

```bash
cd data/postgres/migrations
./run.sh
```

**On a specific database:**

```bash
export PGDATABASE=quailcomp_dev
./run.sh
```

### Verifying Migrations

```bash
cd data/postgres/migrations
./verify.sh
```

The verification script checks:

1. Schema migrations table exists
2. Lists all applied migrations
3. Verifies all migration files have been applied
4. Checks for checksum mismatches

## Migration Tracking

Migrations are tracked in the `schema_migrations` table:

| Column | Type | Description |
|--------|------|-------------|
| version | VARCHAR(100) | Migration filename without `.sql` (e.g., `001_initial_schema`) |
| applied_at | TIMESTAMPTZ | When the migration was executed |
| checksum | VARCHAR(64) | SHA256 hash of the migration file contents |
| execution_time_ms | INTEGER | How long the migration took to execute |

### Checking Migration Status

```bash
# List all applied migrations
psql -c "SELECT version, applied_at, execution_time_ms FROM schema_migrations ORDER BY version"

# Check if specific migration applied
psql -c "SELECT * FROM schema_migrations WHERE version = '001_initial_schema'"

# Find checksum mismatches
psql -c "SELECT version FROM schema_migrations WHERE checksum != 'expected_checksum'"
```

## Environment Configuration

The migration runner uses these environment variables (in priority order):

1. Local `.env` file in `data/postgres/migrations/`
2. Fallback to `data/postgres/setup/.env`
3. System environment variables

Required variables:

- `PGHOST` - Database host (default: localhost)
- `PGPORT` - Database port (default: 5432)
- `PGUSER` - Database superuser (for running migrations)
- `PGDATABASE` - Target database name

Example `.env` file (copy from `.env.example`):

```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGDATABASE=quailcomp
```

## How It Works

### Migration Runner (`run.sh`)

1. Loads environment variables
2. Validates required variables are set
3. Ensures `schema_migrations` table exists
4. Discovers all migration files (`[0-9][0-9][0-9]_*.sql`)
5. For each migration:
   - Checks if already applied (query `schema_migrations`)
   - If applied: verifies checksum, skips
   - If not applied:
     - Calculates SHA256 checksum
     - Executes migration as `quailcomp_owner` role
     - Records in tracking table with execution time
6. Grants privileges to `quailcomp_app` role
7. Runs verification checks

### Checksum Verification

The migration runner calculates SHA256 checksums of migration files and stores them in the tracking table. On subsequent runs:

- If checksum matches: migration is skipped silently
- If checksum differs: **WARNING** is displayed but migration is NOT re-run

This detects accidental modifications to already-applied migrations.

**If you need to fix a migration:**

1. **DO NOT** modify the existing file
2. Create a new migration to correct the issue
3. The new migration will be applied on next run

## Troubleshooting

### Migration fails with "relation already exists"

Your migration is not idempotent. Add `IF NOT EXISTS`:

```sql
-- Bad
CREATE TABLE users (...);

-- Good
CREATE TABLE IF NOT EXISTS users (...);
```

### Checksum mismatch warning

A migration file was modified after being applied. Options:

1. If modification was accidental: revert to original
2. If correction needed: create new migration instead

### Migration not found in tracking table

Run the migration runner to apply it:

```bash
./run.sh
```

### Want to re-run a migration

**DO NOT** manually delete from `schema_migrations`. Instead:

1. Create a new migration that reverses the changes
2. Create another migration with the corrected version

### Database doesn't exist

Migrations assume the database already exists. Run setup first:

```bash
cd data/postgres/setup
./run.sh
```

## Integration with Application

### Test Database

The test database setup ([data/client/scripts/setup-test-db.ts](../../client/scripts/setup-test-db.ts)) automatically runs migrations via `run.sh`.

```bash
bun run db:setup  # Creates test DB and runs migrations
```

### Development Database

For development, you typically:

1. Run setup once: `cd data/postgres/setup && ./run.sh`
2. Run migrations as needed: `bun run db:migrate`

### CI/CD

In production environments:

```bash
cd data/postgres/migrations
./run.sh  # Uses production .env configuration
```

## Best Practices

1. **Keep migrations small and focused**: One migration = one logical change
2. **Always test idempotency**: Run your migration twice before committing
3. **Never modify applied migrations**: Create new migrations to fix issues
4. **Use descriptive names**: `002_add_user_avatar` not `002_update`
5. **Add comments**: Explain why, not just what
6. **Follow naming convention**: Zero-padded numbers, underscores, lowercase
7. **Soft deletes over DROP**: Use `deleted_at` timestamps instead of DROP TABLE
8. **Document data migrations**: If migrating data, document assumptions and edge cases

## See Also

- [CONTRIBUTING.md](../../../CONTRIBUTING.md) - Project-wide database rules and commands
- [setup/README.md](../setup/README.md) - Initial database setup documentation
- [teardown/README.md](../teardown/README.md) - Database teardown procedures
