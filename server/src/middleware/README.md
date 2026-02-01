# Middleware

HTTP middleware for request processing pipeline.

## Files

- [`compose.ts`](compose.ts) - Middleware composition utilities
- [`cors.ts`](cors.ts) - Cross-Origin Resource Sharing (CORS) configuration
- [`error-handler.ts`](error-handler.ts) - Global error handling with Sentry integration
- [`request-id.ts`](request-id.ts) - Request ID tracking and echoing
- [`types.ts`](types.ts) - Middleware type definitions
- [`index.ts`](index.ts) - Public API exports

## Purpose

Provides reusable middleware for the HTTP request/response pipeline.

## Usage

```typescript
import { compose, cors, errorHandler } from './middleware'

// Compose middleware stack
const middleware = compose([
  cors(),
  requestLogger(),
  requestMetrics(),
  errorHandler(),
])

// Apply to server
app.use(middleware)
```

## Available Middleware

### CORS

Configures Cross-Origin Resource Sharing for frontend access:

```typescript
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}))
```

### Error Handler

Catches and formats errors consistently, with Sentry integration:

```typescript
app.use(errorHandler())

// Errors thrown anywhere in the pipeline are handled
throw new Error('Something went wrong')
// Returns: { error: 'Something went wrong' } with appropriate status
// Unexpected errors are also captured in Sentry with full context
```

### Request ID

Echoes request ID in response headers for distributed tracing:

```typescript
app.use(requestIdMiddleware)

// Request ID is extracted from X-Request-Id header or generated
// Response includes: x-request-id: ml4cj1wg-4ljs1gu
```

### Compose

Combines multiple middleware functions into a single handler:

```typescript
const stack = compose([middleware1, middleware2, middleware3])
```

## Middleware Order

Middleware executes in the order it's registered:

1. Error handler (wraps everything to catch errors)
2. Request ID (generate/extract early for logging)
3. Request logging
4. Request metrics
5. CORS (before route handlers)
6. Authentication
7. Authorization
8. Route handlers
