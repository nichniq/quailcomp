# Database Client Scripts

Utility scripts for database operations and testing.

## Files

- [`run-migrations.ts`](run-migrations.ts) - Executes database migrations programmatically
- [`setup-test-db.ts`](setup-test-db.ts) - Creates and initializes test database
- [`teardown-test-db.ts`](teardown-test-db.ts) - Cleans up test database

## Usage

These scripts are typically run via npm/bun scripts or as part of the test lifecycle:

```bash
# Run migrations
bun run db:migrate

# Test setup/teardown (handled automatically by test runner)
bun data/client/scripts/setup-test-db.ts
bun data/client/scripts/teardown-test-db.ts
```

## Documentation

- [Run Migrations](../../../docs/how-to/run-migrations.md)
- [Running Tests](../../../docs/how-to/run-tests.md)
