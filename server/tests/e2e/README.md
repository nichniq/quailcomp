# End-to-End Tests

Complete workflow tests that exercise the entire application stack from HTTP requests to database operations.

## Files

- [`auth-workflow.test.ts`](auth-workflow.test.ts) - User registration, login, and authentication flows
- [`authz-workflow.test.ts`](authz-workflow.test.ts) - Authorization and access control workflows
- [`book-workflow.test.ts`](book-workflow.test.ts) - Book CRUD operations and metadata integration

## Purpose

E2E tests verify that all layers of the application work together correctly:

- HTTP API endpoints
- Authentication middleware
- Authorization checks
- Database operations
- External service integration (book metadata lookup)

Unlike unit tests, E2E tests don't mock internal components - they test the system as users would experience it.

## Running Tests

```bash
# From project root
bun test server/tests/e2e/

# Run specific workflow
bun test server/tests/e2e/auth-workflow.test.ts

# All server tests (includes E2E)
bun run test:server
```

## Prerequisites

- PostgreSQL test database must be running
- Server must be able to start on port 3050
- Environment variables must be configured (see [Environment Variables](../../../docs/reference/environment-variables.md))

## Writing E2E Tests

E2E tests start a real server instance and make actual HTTP requests:

```typescript
import { startServer } from '@/server';

const baseUrl = 'http://localhost:3050';
let stopServer: () => void;

beforeAll(async () => {
  stopServer = await startServer();
});

afterAll(() => {
  stopServer();
});

test('complete workflow', async () => {
  // Make real HTTP requests
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username }),
  });

  expect(response.status).toBe(201);
  const data = await response.json();
  expect(data.token).toBeTruthy();
});
```

## Known Issues

- Authorization E2E tests currently fail because authorization middleware is not yet enabled on book routes
- These tests will pass once authorization middleware is properly integrated

See [Running Tests](../../../docs/how-to/run-tests.md) for more guidelines.
