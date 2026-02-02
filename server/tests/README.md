# Server Tests

Comprehensive test suite for the Quailcomp server application.

## Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `auth.test.ts` | 47 | JWT, password utilities, AuthService, AuthorizationService |
| `middleware.test.ts` | 14 | requireAuth, optionalAuth, requireAccess middleware |
| `error-handler.test.ts` | 28 | HTTP errors, CORS, middleware composition |
| `logging.test.ts` | 23 | Logger, request logging middleware |
| `metrics.test.ts` | 25 | Metrics collector, request metrics middleware |
| `routes.test.ts` | 25 | Books CRUD, health/metrics endpoints, authentication flows |
| `observability.test.ts` | 5 | Prometheus metrics, request ID tracking, JSON metrics |
| `openapi.test.ts` | 12 | OpenAPI spec generation, endpoint documentation |
| `bulk-operations.test.ts` | 27 | Import/export parsers (CSV/JSON/XLSX), formatters, bulk operations |
| `people.test.ts` | 19 | People CRUD operations, authorization |
| `series.test.ts` | 19 | Series CRUD operations, authorization |

**Total:** 244 server tests

## What's Tested

### Authentication & Authorization

- **JWT**: Token signing, verification, extraction, expiration
- **Password**: Hashing (bcrypt), verification, validation
- **Auth Service**: User registration, login, duplicate handling, email validation
- **Authorization Service**: Access control (owner/write/read), permissions, ownership transfer

### Middleware

- **Authentication**: `requireAuth`, `optionalAuth`
- **Authorization**: `requireAccess`, `requireRead`, `requireWrite`, `requireOwner`
- **Error Handling**: HTTP error classes, error responses, 500 handling
- **CORS**: Origin validation, preflight requests, headers
- **Composition**: Middleware chaining, short-circuiting

### Infrastructure

- **Logging**: Structured JSON logging, log levels, child loggers, request lifecycle
- **Metrics**: Counters, histograms, request tracking, latency measurement
- **Observability**: Prometheus text format, request ID tracking, metrics endpoints

### API Routes

- **Books**: Create, read, update, delete (soft delete) operations
- **Bulk Operations**: Import (CSV/JSON/XLSX), export (CSV/JSON/XLSX), batch updates
- **Metadata Lookup**: ISBN validation, error handling, authentication
- **Health**: Database connectivity checks, error states
- **Metrics**: Snapshot endpoint for monitoring
- **API Documentation**: OpenAPI spec generation, Swagger UI endpoints
- **People**: People CRUD operations with authorization
- **Series**: Series CRUD operations with authorization

## Test Patterns

### Unique Test Data

All tests use timestamps to ensure unique data:

```typescript
const testTimestamp = Date.now();
const email = `test-${testTimestamp}@example.com`;
```

### Database Entities

When creating test entities, use `nextval()`:

```typescript
const [entity] = await sql`
  INSERT INTO entities (entity_id, type, data)
  VALUES (nextval('entity_id_seq'), 'test_type', ${{ test: true }})
  RETURNING entity_id
`;
```

### Console Capture

Logging tests capture console output:

```typescript
beforeEach(() => {
  originalLog = console.log;
  console.log = (msg) => capturedLogs.push(msg);
});

afterEach(() => {
  console.log = originalLog;
});
```

### Middleware Testing

Test middleware by creating mock handlers:

```typescript
const handler: Handler = async (ctx, req) => {
  return new Response("success");
};
const middleware = requireAuth(handler);
const response = await middleware(ctx, request);
```

### Route Testing

Test routes through the router with authentication:

```typescript
// Create authenticated request with JWT token
async function createAuthenticatedRequest(url: string, options?: RequestInit): Promise<Request> {
  const token = await signToken({ user_id: 123, email: "test@example.com" });
  const headers = new Headers(options?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(url, { ...options, headers });
}

// Test route through router
const request = await createAuthenticatedRequest("http://localhost/books");
const ctx = createContext(request, sql);
const match = router.match("GET", "/books");
const response = await match.route.handler(ctx, request);
```

## Running Tests

```bash
# Run all server tests
cd server && bun test

# Run specific test file
bun test tests/auth.test.ts

# Run with coverage
bun test --coverage
```

## Coverage Goals

The server test suite targets 90% code coverage for:

- Core business logic (auth, authz)
- Middleware components
- Infrastructure (logging, metrics)
- API routes (when implemented)
