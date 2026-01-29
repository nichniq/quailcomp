# Logging Service

Structured logging for HTTP requests and application events.

## Files

- [`logger.ts`](logger.ts) - Core logger implementation with structured output
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

Logs are structured as JSON for easy parsing and aggregation:

```json
{
  "level": "info",
  "timestamp": "2026-01-28T12:00:00Z",
  "message": "Request completed",
  "method": "GET",
  "path": "/api/books",
  "status": 200,
  "duration": 45
}
```

## Request Logging

The request logger middleware automatically logs:

- HTTP method and path
- Response status code
- Request duration
- User agent and IP address
- Request/response body (configurable)
