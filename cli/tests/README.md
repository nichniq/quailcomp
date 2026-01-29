# CLI Tests

Unit tests for CLI commands, routing, and utilities.

## Files

- [`books.test.ts`](books.test.ts) - Tests for book management commands
- [`metadata.test.ts`](metadata.test.ts) - Tests for metadata lookup commands
- [`router.test.ts`](router.test.ts) - Tests for command routing logic
- [`output.test.ts`](output.test.ts) - Tests for output formatting utilities

## Running Tests

```bash
# From project root
bun test cli/tests

# Run specific test file
bun test cli/tests/books.test.ts
```

## Test Structure

Tests verify:

- Command argument parsing
- Database operations (using test database)
- Output formatting
- Error handling
- Command routing

See [Running Tests](../../docs/how-to/run-tests.md) for testing guidelines.
