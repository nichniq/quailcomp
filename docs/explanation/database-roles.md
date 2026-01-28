# Why Database Roles?

This document explains the role-based access control pattern used in Quailcomp's PostgreSQL setup.

## The Two Roles

Quailcomp uses two database roles with different purposes:

### quailcomp_owner

**Purpose:** Database administration and migrations

**Characteristics:**

- `NOLOGIN` - Cannot be used to authenticate directly
- Owns the database and schema
- Can create tables and grant privileges
- Used for running migrations

**When used:**

- Running `bun run db:migrate`
- Creating new tables or indexes
- Modifying schema

### quailcomp_app

**Purpose:** Application connections

**Characteristics:**

- `LOGIN` - Used by the application to connect
- Limited privileges: SELECT and INSERT only
- Cannot create or modify database objects
- Used for all application queries

**When used:**

- All application code
- API requests
- CLI commands

## Why This Separation?

### Principle of Least Privilege

The application only needs to read and write data. It doesn't need to:

- Create tables
- Drop indexes
- Modify schema
- Grant privileges

By limiting `quailcomp_app` to SELECT and INSERT, we reduce the blast radius if the application is compromised.

### Append-Only Pattern

Quailcomp uses append-only storage. The application never needs UPDATE or DELETE:

```sql
-- Traditional pattern (needs UPDATE)
UPDATE books SET title = 'New Title' WHERE id = 42;

-- Append-only pattern (only needs INSERT)
INSERT INTO entities (entity_id, type, data) VALUES (42, 'book', '{"title": "New Title"}');
```

This aligns with event sourcing—changes create new entries, not modify existing ones.

### Migration Safety

Migrations run as `quailcomp_owner`, separate from application code. This means:

- Migrations can create tables, indexes, etc.
- Application code can't accidentally run DDL
- Clear separation between schema changes and data access

## How It Works

### Database Setup

The setup scripts create this structure:

```sql
-- Create the owner role (no login)
CREATE ROLE quailcomp_owner NOLOGIN;

-- Create the app role (with login)
CREATE ROLE quailcomp_app LOGIN PASSWORD 'app_password';

-- Create database owned by owner
CREATE DATABASE quailcomp OWNER quailcomp_owner;

-- App can connect but not create objects
GRANT CONNECT ON DATABASE quailcomp TO quailcomp_app;

-- App can read and write data
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO quailcomp_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO quailcomp_app;
```

### Migrations

Migrations run as `quailcomp_owner` through a `SET ROLE` statement:

```sql
SET ROLE quailcomp_owner;

CREATE TABLE IF NOT EXISTS new_table (...);
```

This allows the migration script to create objects while the connection might be established with a superuser.

### Application Code

Application code connects as `quailcomp_app`:

```typescript
const sql = createConnection({
  host: 'localhost',
  database: 'quailcomp',
  user: 'quailcomp_app',  // Limited role
  password: process.env.DB_PASSWORD
})
```

All queries run with SELECT/INSERT privileges only.

## Default Privileges

The setup includes default privileges so new tables automatically grant access to `quailcomp_app`:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE quailcomp_owner
  GRANT SELECT, INSERT ON TABLES TO quailcomp_app;

ALTER DEFAULT PRIVILEGES FOR ROLE quailcomp_owner
  GRANT USAGE ON SEQUENCES TO quailcomp_app;
```

When a migration creates a new table as `quailcomp_owner`, the app role can immediately use it.

## Security Model

### What quailcomp_app CAN Do

- SELECT from any table
- INSERT into any table
- Use sequences (for auto-increment IDs)

### What quailcomp_app CANNOT Do

- UPDATE existing rows
- DELETE rows
- CREATE/DROP/ALTER tables
- TRUNCATE tables
- Grant privileges to other roles

### Why No UPDATE or DELETE?

The append-only model means:

- Updates create new entries (INSERT)
- Deletes set `deleted_at` timestamp (INSERT)

The application never needs to modify or remove existing rows.

## Practical Implications

### For Development

Connect as `quailcomp_app` for normal development:

```bash
export DB_USER=quailcomp_app
export DB_PASSWORD=your_password
```

### For Migrations

Migrations run through the migration script, which handles role switching:

```bash
bun run db:migrate
```

### For Backups

Backups typically need a superuser or `quailcomp_owner`:

```bash
export PGUSER=postgres  # or quailcomp_owner with LOGIN
./data/postgres/ops/backup.sh
```

### For Debugging

If you need to run administrative queries:

```bash
psql -U postgres -d quailcomp
```

Or temporarily assume the owner role:

```sql
SET ROLE quailcomp_owner;
-- Run administrative queries
RESET ROLE;
```

## Troubleshooting

### "Permission Denied" Errors

If the application gets permission errors:

1. Check you're connected as `quailcomp_app`
2. Verify the table was created by `quailcomp_owner`
3. Check default privileges are set

```sql
-- Verify privileges
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'entities';
```

### Migration Fails with Permission Error

Ensure migrations run with owner privileges:

```sql
-- Check current role
SELECT current_role;

-- Should be quailcomp_owner during migrations
```

### New Table Not Accessible

If a migration creates a table but the app can't access it:

```sql
-- Grant access manually
GRANT SELECT, INSERT ON new_table TO quailcomp_app;
GRANT USAGE ON new_table_id_seq TO quailcomp_app;
```

Then fix the default privileges for future tables.

## Comparison with Alternatives

### Single Role (Simpler but Less Secure)

```sql
CREATE ROLE quailcomp_app LOGIN ... CREATEDB;
```

Pros: Simpler setup
Cons: App can modify schema, higher risk if compromised

### Multiple App Roles (More Complex)

```sql
CREATE ROLE quailcomp_reader;  -- SELECT only
CREATE ROLE quailcomp_writer;  -- SELECT, INSERT
CREATE ROLE quailcomp_admin;   -- Full access
```

Pros: Finer-grained control
Cons: More complexity, more roles to manage

### The Quailcomp Approach

Two roles (owner + app) balances security and simplicity for a personal data management system.

## Related

- [Development Setup](../how-to/setup-development.md) - Initial database setup
- [Run Migrations](../how-to/run-migrations.md) - Migration process
- [Backup and Restore](../how-to/backup-restore-database.md) - Backup permissions
