# Database Setup

This directory contains scripts to bootstrap the quailcomp PostgreSQL database with the necessary roles, database, schemas, and privileges.

## Database Structure

The quailcomp database follows a secure, role-based access control pattern:

### Roles

- **quailcomp_owner**: Database owner role (NOLOGIN)
  - Cannot be used to authenticate or open sessions
  - Owns the database and schema
  - Can create tables and grant privileges on objects it owns
  - Used for administrative operations and migrations

- **quailcomp_app**: Application role (LOGIN)
  - Used by the application to connect to the database
  - Has SELECT and INSERT privileges only (append-only pattern)
  - Cannot create or modify database objects

### Database

- **quailcomp**: Main database
  - Owner: `quailcomp_owner`
  - Uses the `public` schema
  - PUBLIC access revoked (explicit access control)

### Security Model

1. Default PUBLIC privileges are revoked at both database and schema levels
2. Explicit CONNECT privilege granted to `quailcomp_app`
3. Application role has limited privileges (SELECT, INSERT only)
4. Default privileges configured for future tables created by `quailcomp_owner`

## Execution Order

The setup scripts must be executed in the following order:

1. [001_roles.sql](001_roles.sql) - Create `quailcomp_owner` and `quailcomp_app` roles
2. [002_database.sql](002_database.sql) - Create `quailcomp` database with ownership
3. [003_schemas.sql](003_schemas.sql) - Configure `public` schema ownership and access
4. [004_privileges.sql](004_privileges.sql) - Set table privileges for existing and future tables

This order is enforced because:

- Roles must exist before databases can be assigned an owner
- The database must exist before schemas can be altered
- Schemas must exist before privileges can be applied

## How to Run

### Prerequisites

- PostgreSQL client tools (`psql`) installed
- Access to a PostgreSQL server
- Admin credentials (e.g., `postgres` user)

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
   PGDATABASE=postgres
   ```

   **Note**: The [.env](.env) file is gitignored and should never be committed to version control.

### Execute the Runner

Run the setup script from any location:

```bash
./db/setup/run.sh
```

Or from within this directory:

```bash
./run.sh
```

The script will:

1. Load environment variables from [.env](.env)
2. Verify all required variables are set
3. Execute SQL files in the correct order
4. Stop immediately if any statement fails
5. Report success or failure

### Safety Features

The [run.sh](run.sh) script includes several safety mechanisms:

- `set -euo pipefail` - Exits immediately on any error
- `ON_ERROR_STOP=1` - Stops psql execution on SQL errors
- Idempotent SQL scripts - Can be run multiple times safely
- Environment variable validation - Ensures required configuration is present

## Idempotency

All SQL scripts use idempotent patterns, making them safe to run multiple times. If objects already exist, the scripts will skip creation and update ownership/privileges as needed.

**Idempotency patterns used:**

- Roles ([001_roles.sql](001_roles.sql)): `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- Database ([002_database.sql](002_database.sql)): `SELECT ... WHERE NOT EXISTS (...)\gexec`
- Schemas and privileges: `ALTER`, `GRANT`, and `REVOKE` statements are naturally idempotent

## Troubleshooting

### Permission Denied

If you see permission errors, ensure your `PGUSER` has sufficient privileges (e.g., `CREATEROLE`, `CREATEDB`).

### Connection Failed

Verify your connection settings in [.env](.env):

- Check `PGHOST` and `PGPORT` are correct
- Ensure PostgreSQL server is running
- Verify firewall allows connections

### Script Fails Midway

If setup fails partway through, the script's safety mechanisms prevent partial application. Review the error message, fix the issue, and re-run [run.sh](run.sh).
