# Middleware

HTTP middleware for request processing pipeline.

## Files

- [`compose.ts`](compose.ts) - Middleware composition utilities
- [`cors.ts`](cors.ts) - Cross-Origin Resource Sharing (CORS) configuration
- [`error-handler.ts`](error-handler.ts) - Global error handling middleware
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

Catches and formats errors consistently:

```typescript
app.use(errorHandler())

// Errors thrown anywhere in the pipeline are handled
throw new Error('Something went wrong')
// Returns: { error: 'Something went wrong' } with appropriate status
```

### Compose

Combines multiple middleware functions into a single handler:

```typescript
const stack = compose([middleware1, middleware2, middleware3])
```

## Middleware Order

Middleware executes in the order it's registered:

1. CORS (must be early for preflight requests)
2. Request logging
3. Request metrics
4. Authentication
5. Authorization
6. Route handlers
7. Error handler (must be last to catch all errors)
