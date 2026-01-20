# Database Teardown

This directory contains scripts to completely remove the quailcomp database, including all data, schemas, and roles.

## ⚠️ WARNING: DESTRUCTIVE OPERATIONS ⚠️

These scripts **permanently delete**:
- The `quailcomp` database and all its data
- The `quailcomp_app` role
- The `quailcomp_owner` role

**There is no undo.** Always ensure you have backups before running teardown.

## When to Use Teardown

Teardown is appropriate for:

- **Local development**: Cleaning up after testing or starting fresh
- **CI/CD environments**: Resetting ephemeral test databases
- **Decommissioning**: Removing databases that are no longer needed
- **Failed setup recovery**: Cleaning up after a failed setup to retry

Teardown is **NOT appropriate** for:
- **Production databases**: Protected by `ENVIRONMENT` check
- **Active development databases**: Risk of losing uncommitted work
- **Databases with valuable data**: Backup first with [db/ops/backup.sh](../ops/backup.sh)

## How It Works

The teardown process executes three steps in order:

1. [001_terminate_connections.sql](001_terminate_connections.sql) - Forcibly close all active connections to the database
2. [002_drop_database.sql](002_drop_database.sql) - Drop the `quailcomp` database
3. [003_drop_roles.sql](003_drop_roles.sql) - Drop `quailcomp_app` and `quailcomp_owner` roles

### Execution Order

The order is critical:
- Connections must be terminated before the database can be dropped
- Objects owned by roles must be dropped before the roles can be removed
- `quailcomp_app` is dropped before `quailcomp_owner` (dependency order)

## How to Run

### Prerequisites

You must connect as a role that can:
- Terminate connections
- Drop databases
- Drop roles

This is typically:
- A local superuser (e.g., `postgres`)
- A managed service admin role

### Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit [.env](.env) with your database connection details:
   ```bash
   PGHOST=localhost
   PGPORT=5432
   PGUSER=postgres
   PGPASSWORD=<your_admin_password>
   PGDATABASE=postgres  # Must be a different DB than quailcomp
   ```

   **Important**: `PGDATABASE` must be set to a database **other than** `quailcomp` (e.g., `postgres`), since you cannot drop a database you're currently connected to.

### Execute the Teardown

Run the teardown script from any location:

```bash
./db/teardown/run.sh
```

Or from within this directory:

```bash
./run.sh
```

### Confirmation Required

The script requires explicit confirmation to prevent accidents:

```
⚠️ DESTRUCTIVE OPERATION WARNING ⚠️
This will permanently delete:
  - Database: quailcomp
  - Roles: quailcomp_app, quailcomp_owner

Type 'DROP quailcomp' to continue: DROP quailcomp
```

Type exactly `DROP quailcomp` and press Enter to proceed. Any other input aborts the operation.

## Safety Features

### Production Protection

The [run.sh](run.sh:12-15) script refuses to run in production:

```bash
if [[ "${ENVIRONMENT:-}" == "production" ]]; then
  echo "Refusing to run teardown in production"
  exit 1
fi
```

To mark an environment as production:
```bash
export ENVIRONMENT=production
```

### Explicit Confirmation

Manual confirmation is required every time, preventing:
- Accidental execution
- Scripted deletion without human review

### Safe Exit on Error

The script uses `set -euo pipefail` to:
- Exit immediately on any error (`-e`)
- Fail on undefined variables (`-u`)
- Catch errors in pipelines (`pipefail`)

This prevents partial teardown that could leave the database in an inconsistent state.

### Idempotent SQL

All SQL scripts use `IF EXISTS` clauses:
- Safe to run even if objects don't exist
- Can be re-run after partial failures
- Won't error if database was already removed

## Script Details

### [001_terminate_connections.sql](001_terminate_connections.sql)

Terminates all active connections to the `quailcomp` database except the current session.

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'quailcomp'
  AND pid <> pg_backend_pid();
```

**Why**: PostgreSQL cannot drop a database that has active connections. This script forcibly disconnects all users.

**Impact**: Any running queries or transactions will be immediately cancelled.

### [002_drop_database.sql](002_drop_database.sql)

Drops the entire `quailcomp` database.

```sql
DROP DATABASE IF EXISTS quailcomp;
```

**What's deleted**:
- All tables and their data
- All schemas (including `public`)
- All sequences, indexes, constraints
- All triggers, functions, views
- All privileges granted on database objects

**What's preserved**:
- Roles (dropped separately in step 3)
- Other databases
- Cluster-wide settings

### [003_drop_roles.sql](003_drop_roles.sql)

Drops the `quailcomp_app` and `quailcomp_owner` roles.

```sql
DROP ROLE IF EXISTS quailcomp_app;
DROP ROLE IF EXISTS quailcomp_owner;
```

**Order matters**: `quailcomp_app` is dropped first, then `quailcomp_owner`, to respect any role dependencies.

## Common Workflows

### Clean Restart in Development

```bash
# 1. Backup current state (optional)
./db/ops/backup.sh

# 2. Tear down everything
./db/teardown/run.sh

# 3. Set up fresh database
./db/setup/run.sh

# 4. Run migrations (when available)
# ./db/migrations/run.sh
```

### Reset Test Database

```bash
# Quick reset for testing
./db/teardown/run.sh && ./db/setup/run.sh
```

### Failed Setup Recovery

```bash
# If setup failed partway through
./db/teardown/run.sh  # Clean up partial state
./db/setup/run.sh     # Try again with clean slate
```

### Switch Between Branches

```bash
# When switching to a branch with different schema
./db/ops/backup.sh              # Save current state
git checkout other-branch
./db/teardown/run.sh            # Remove old schema
./db/setup/run.sh               # Apply new schema
# Run migrations for new branch
```

## What Happens to Backups?

Teardown **does not** delete backup files in [db/ops/backups/](../ops/backups/). Your backups remain intact and can be used to restore data after teardown.

To completely remove everything including backups:
```bash
./db/teardown/run.sh
rm -rf ../ops/backups/*.dump
```

## Troubleshooting

### Cannot Drop Database - Connections Exist

If you see:
```
ERROR: database "quailcomp" is being accessed by other users
```

The [001_terminate_connections.sql](001_terminate_connections.sql) script should handle this, but if connections are re-established between termination and drop:

```bash
# Manually terminate connections
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'quailcomp' AND pid <> pg_backend_pid();"

# Then run teardown again
./db/teardown/run.sh
```

### Permission Denied

Ensure your `PGUSER` has sufficient privileges:
- Superuser, OR
- `CREATEROLE` and `CREATEDB` privileges

Check with:
```bash
psql -c "\du"
```

### Already Connected to quailcomp

If `PGDATABASE=quailcomp` in your environment:
```
ERROR: cannot drop the currently open database
```

Solution: Set `PGDATABASE` to a different database (e.g., `postgres`) in [.env](.env).

### Production Environment Check Blocks Teardown

If teardown refuses to run but you're certain it's not production:

```bash
# Check if ENVIRONMENT is set
echo $ENVIRONMENT

# Unset it
unset ENVIRONMENT

# Run teardown
./db/teardown/run.sh
```

## Environment Variables

The teardown script uses standard PostgreSQL environment variables. See [.env.example](.env.example) for the template.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PGHOST` | Database host | `localhost` |
| `PGPORT` | Database port | `5432` |
| `PGUSER` | Admin user with drop privileges | `postgres` |
| `PGPASSWORD` | Admin password (optional) | `your_password` |
| `PGDATABASE` | Database to connect to (NOT quailcomp) | `postgres` |

### Optional Variables

| Variable | Description | Effect |
|----------|-------------|--------|
| `ENVIRONMENT` | Environment name | If set to `production`, teardown is blocked |

## After Teardown

After successful teardown:
- All quailcomp data is permanently deleted
- Roles are removed from the PostgreSQL cluster
- You can run [db/setup/run.sh](../setup/run.sh) to recreate a fresh database
- Existing backups in [db/ops/backups/](../ops/backups/) can still be restored

## Related Documentation

- [Database Setup](../setup/README.md) - Create database and roles
- [Database Operations](../ops/README.md) - Backup and restore
