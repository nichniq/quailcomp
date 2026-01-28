# How to Run Tests

This guide covers running tests in the Quailcomp project.

## Quick Reference

| Command | Description |
|---------|-------------|
| `bun test` | Run all tests with linting |
| `bun test:unit` | Run tests without linting |
| `bun test:watch` | Watch mode for data/client |

## Running Tests

### All Tests

```bash
bun test
```

This runs the full test suite including linting. Use this after making code changes to verify everything works.

### Unit Tests Only

```bash
bun test:unit
```

Skips linting for faster feedback during development.

### Watch Mode

```bash
bun test:watch
```

Automatically re-runs tests when files change. Currently configured for `data/client/` tests.

## Test Database

Tests use a separate `quailcomp_test` database to avoid polluting development data.

### Automatic Management

The test database is automatically:

- Created on first test run
- Migrations applied
- Cleaned up when tests complete

You rarely need to manage it manually.

### Manual Commands

If you need to reset the test database:

```bash
bun run db:setup     # Create test database
bun run db:teardown  # Drop test database
```

## Writing Tests

### Test Isolation

Tests must use unique type names to avoid conflicts between test runs:

```typescript
import { test, expect } from 'bun:test'

test('create book entity', async () => {
  // Use timestamp to ensure unique type name
  const type = `book_${Date.now()}`

  const book = await entities.create({
    type,
    data: { title: 'Test Book' }
  })

  expect(book.entity_id).toBeGreaterThan(0)
  expect(book.data.title).toBe('Test Book')
})
```

### Test Structure

Tests use Bun's built-in test runner:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

describe('EntitiesClient', () => {
  let sql: Connection
  let entities: EntitiesClient

  beforeAll(async () => {
    sql = getConnection()
    entities = new EntitiesClient(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  test('creates entity with auto-generated id', async () => {
    // test implementation
  })
})
```

### What's Tested

The test suite covers:

- **Setup & Connection** - Database connectivity and schema verification
- **Create Operations** - Entity creation, auto-increment, transactions
- **Update Operations** - Append-only updates, sequence preservation
- **Delete Operations** - Soft delete, restore, query exclusion
- **Read Operations** - Get by ID, history, type queries, counting
- **Search Operations** - JSONB containment queries
- **Edge Cases** - Empty data, large payloads, special characters
- **Trigger Validation** - entity_id validation rules
- **Index Effectiveness** - Query plan verification

## Avoiding Common Issues

### Don't Truncate Tables

Tests should not truncate tables between runs. Use unique type names instead:

```typescript
// Bad - affects other tests
await sql`TRUNCATE entities`

// Good - isolated by unique type
const type = `test_${Date.now()}`
```

### Don't Use Raw SQL Strings

Use Bun's SQL tagged templates to prevent SQL injection:

```typescript
// Bad - SQL injection risk
await sql.query(`SELECT * FROM entities WHERE type = '${type}'`)

// Good - parameterized query
await sql`SELECT * FROM entities WHERE type = ${type}`
```

## Troubleshooting

### Test Database Connection Fails

Check that:

1. PostgreSQL is running: `pg_isready`
2. Test database exists: `psql -l | grep quailcomp_test`
3. Environment variables are set correctly

### Permission Denied Errors

Ensure `quailcomp_app` has correct permissions:

```sql
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO quailcomp_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO quailcomp_app;
```

### Tests Pass Locally but Fail in CI

Ensure your migrations are committed. The test database setup runs all migrations from `data/postgres/migrations/`.

## Related

- [Development Setup](setup-development.md) - First-time environment setup
- [Commit Changes](commit-changes.md) - Run tests before committing
- [Environment Variables](../reference/environment-variables.md) - Database configuration
