# PostgreSQL Database

PostgreSQL schema definitions, migrations, and operational scripts.

## Structure

- [**setup/**](setup/) - Database initialization (roles, database, schemas, privileges)
- [**migrations/**](migrations/) - Schema evolution scripts
- [**ops/**](ops/) - Operational scripts (backup, restore)
- [**teardown/**](teardown/) - Database cleanup scripts

## Quick Commands

```bash
# Setup database from scratch
cd data/postgres/setup && bash run.sh

# Run migrations
bun run db:migrate

# Backup database
cd data/postgres/ops && bash backup.sh

# Teardown database
cd data/postgres/teardown && bash run.sh
```

## Documentation

- [Database Setup](../../docs/how-to/setup-development.md)
- [Run Migrations](../../docs/how-to/run-migrations.md)
- [Backup and Restore](../../docs/how-to/backup-restore-database.md)
- [Database Roles](../../docs/explanation/database-roles.md)
- [Event Sourcing](../../docs/explanation/event-sourcing.md)

## Key Concepts

This database uses:

- **Event Sourcing**: Immutable events in `app.events`, mutable state in `app.entities`
- **Dual Roles**: `quailcomp_owner` for DDL, `quailcomp_app` for DML
- **Idempotent Operations**: All setup/migration/teardown scripts can run multiple times safely
