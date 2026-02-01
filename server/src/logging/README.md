# Logging Service

Structured logging for HTTP requests and application events.

## Files

- [`logger.ts`](logger.ts) - Core logger interface and console logger implementation
- [`pino-logger.ts`](pino-logger.ts) - Pino logger adapter (production, with field redaction)
- [`request-logger.ts`](request-logger.ts) - HTTP request/response logging middleware
- [`index.ts`](index.ts) - Public API exports

## Usage

```typescript
import { logger, requestLogger } from './logging'

// Add request logging middleware
app.use(requestLogger())

// Application logging
logger.info('Application started', { port: 3000 })
logger.error('Database connection failed', { error: err.message })
logger.debug('Processing request', { userId: user.id })
```

## Log Levels

- `debug` - Detailed diagnostic information
- `info` - General informational messages
- `warn` - Warning messages for potentially harmful situations
- `error` - Error messages for failures

## Output Format

In **development**, logs are pretty-printed with colors for readability:

```
[23:02:28.193] INFO: Request started
    requestId: "ml4cj1wg-4ljs1gu"
    method: "GET"
    path: "/health"
```

In **production**, logs are structured as JSON for easy parsing and aggregation:

```json
{
  "level": 30,
  "time": "2026-01-28T12:00:00.000Z",
  "msg": "Request completed",
  "requestId": "ml4cj1wg-4ljs1gu",
  "method": "GET",
  "path": "/api/books",
  "status": 200,
  "durationMs": 45
}
```

**Sensitive fields** (passwords, tokens, secrets, API keys) are automatically redacted in logs.

## Request Logging

The request logger middleware automatically logs:

- HTTP method and path
- Response status code
- Request duration
- User agent and IP address
- Request/response body (configurable)
