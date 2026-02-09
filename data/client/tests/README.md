# Database Client Tests

Integration tests for database clients.

## Files

- [`config.test.ts`](config.test.ts) - Tests for database configuration and environment variables
- [`connection.test.ts`](connection.test.ts) - Tests for database connection management
- [`entities.test.ts`](entities.test.ts) - Tests for `EntitiesClient` (CRUD operations)
- [`errors.test.ts`](errors.test.ts) - Tests for database error handling and parsing
- [`events.test.ts`](events.test.ts) - Tests for `EventsClient` (append-only events)
- [`properties.test.ts`](properties.test.ts) - Property-based tests using fast-check to verify invariants
- [`types.test.ts`](types.test.ts) - Tests for type definitions and typed repositories

## Running Tests

```bash
# From project root
bun test data/client/tests

# Run specific test file
bun test data/client/tests/entities.test.ts
```

## Test Database

Tests use a dedicated test database (`quailcomp_test`) that is:

- Set up before each test run
- Cleaned up after tests complete
- Isolated from development and production databases

See [`setup-test-db.ts`](../scripts/setup-test-db.ts) and [`teardown-test-db.ts`](../scripts/teardown-test-db.ts) for details.

## Writing Tests

Each test suite uses unique type names with timestamps to avoid conflicts:

```typescript
const uniqueType = `test_${Date.now()}`
await entities.create(uniqueType, { ... })
```

See [Running Tests](../../../docs/how-to/run-tests.md) for more guidelines.
