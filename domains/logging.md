# Logging

> Structured JSON logging with context threading for observability across the application.

The Logging domain provides a structured logging system that outputs JSON-formatted log entries to the console. This enables easy parsing, aggregation, and analysis by log management tools like Datadog, Splunk, or CloudWatch.

Logging is foundational to observability - every component logs important events, errors, and debug information using a consistent format. Child loggers carry context through request lifecycles, making it easy to trace operations across the system.

## Log Levels

> Four log levels control verbosity: debug, info, warn, error.

Log levels filter output based on severity. Setting a minimum log level (via `LOG_LEVEL` environment variable) suppresses less important messages:

- **debug** (0) - Detailed diagnostic information for development
- **info** (1) - General informational messages about system operation
- **warn** (2) - Warning messages about potential issues
- **error** (3) - Error messages indicating failures

```typescript
export type LogLevel = "debug" | "info" | "warn" | "error";
```

**Level Hierarchy:** Each level includes all higher levels. Setting `LOG_LEVEL=warn` outputs warn and error logs, suppressing debug and info.

## Log Entries

> Structured log entries combine level, message, timestamp, and arbitrary context data.

Every log is a JSON object with required fields (level, message, timestamp) plus optional context:

```typescript
export type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string; // ISO 8601 format
  [key: string]: unknown; // Arbitrary context data
};
```

**Example Output:**

```json
{
  "level": "info",
  "message": "HTTP request completed",
  "timestamp": "2026-02-06T10:30:45.123Z",
  "method": "GET",
  "path": "/api/books",
  "duration_ms": 42,
  "status": 200,
  "request_id": "req_abc123"
}
```

## Logger Interface

> Loggers provide methods for each log level plus child logger creation.

The `Logger` interface defines the contract for all logger implementations:

```typescript
export type Logger = {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;

  /** Create child logger with additional context */
  child(context: Record<string, unknown>): Logger;
};
```

**Child Loggers:** Child loggers inherit parent context and add additional fields. This enables context threading through operation chains.

## Logger Options

> Configure logger behavior with log level and persistent context.

Logger configuration controls minimum log level and default context:

```typescript
export type LoggerOptions = {
  level?: LogLevel; // Minimum level to output (default: 'info')
  context?: Record<string, unknown>; // Persistent context added to all logs
};
```

## Usage Examples

### Basic Logging

```typescript
import { createLogger } from '@/server/src/logging/logger';

const logger = createLogger({ level: 'info' });

logger.info('Server starting');
// {"level":"info","message":"Server starting","timestamp":"2026-02-06T10:30:00.000Z"}

logger.debug('Detailed debug info'); // Suppressed (below 'info' level)

logger.error('Failed to connect to database', {
  error: 'connection timeout',
  host: 'localhost',
  port: 5432,
});
// {"level":"error","message":"Failed to connect to database","timestamp":"...","error":"connection timeout","host":"localhost","port":5432}
```

### Child Loggers with Context

```typescript
import { createLogger } from '@/server/src/logging/logger';

const rootLogger = createLogger();

// Create child logger with request context
const requestLogger = rootLogger.child({
  request_id: 'req_abc123',
  user_id: 42,
  method: 'GET',
  path: '/api/books',
});

// All logs from requestLogger include request context
requestLogger.info('Processing request');
// {"level":"info","message":"Processing request","timestamp":"...","request_id":"req_abc123","user_id":42,"method":"GET","path":"/api/books"}

requestLogger.info('Database query executed', { duration_ms: 15 });
// {"level":"info","message":"Database query executed","timestamp":"...","request_id":"req_abc123","user_id":42,"method":"GET","path":"/api/books","duration_ms":15}
```

### Request Context Threading

```typescript
import { createLogger } from '@/server/src/logging/logger';
import type { RequestContext } from '@/server/src/context';

// Create request-scoped logger in middleware
function createRequestContext(req: Request): RequestContext {
  const requestId = crypto.randomUUID();

  const logger = createLogger().child({
    request_id: requestId,
    method: req.method,
    path: new URL(req.url).pathname,
  });

  return {
    request_id: requestId,
    logger,
    // ... other context fields
  };
}

// Use logger throughout request lifecycle
async function handleRequest(ctx: RequestContext) {
  ctx.logger.info('Request started');

  try {
    const result = await fetchData(ctx);
    ctx.logger.info('Request completed', { status: 200 });
    return new Response(JSON.stringify(result));
  } catch (error) {
    ctx.logger.error('Request failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
```

### Environment-Specific Log Levels

```typescript
import { createLogger } from '@/server/src/logging/logger';
import { env, isDevelopment } from '@/server/src/config';

// Use LOG_LEVEL from configuration
const logger = createLogger({ level: env.LOG_LEVEL });

// Development-only debug logs
if (isDevelopment()) {
  logger.debug('Configuration loaded', {
    port: env.PORT,
    database: env.DATABASE_URL,
  });
}
```

### Error Logging with Stack Traces

```typescript
import { createLogger } from '@/server/src/logging/logger';

const logger = createLogger();

try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    error_message: error instanceof Error ? error.message : String(error),
    error_stack: error instanceof Error ? error.stack : undefined,
    operation: 'riskyOperation',
  });
  throw error;
}
```

## Log Output Routing

> Log level determines console method (console.error, console.warn, console.log).

The logger routes output based on log level:

- `error` → `console.error()`
- `warn` → `console.warn()`
- `info`, `debug` → `console.log()`

This allows log aggregation tools to filter by stderr (errors/warnings) vs stdout (info/debug).

## Implementation Details

### Console Logger (Test Environment)

In test mode (`NODE_ENV=test`), a simple `ConsoleLogger` implementation writes JSON directly to console methods. This provides predictable output for test assertions.

### Pino Logger (Production/Development)

In production and development, the logger uses Pino for high-performance structured logging with additional features like log rotation, pretty printing, and custom serializers.

**Factory Function:**

```typescript
export type LoggerFactory = (options?: LoggerOptions) => Logger;
```

The `createLogger()` factory automatically selects the appropriate implementation based on `NODE_ENV`.

## Integration Points

- **[Configuration Domain](./configuration.md)** - Uses `env.LOG_LEVEL` to set minimum log level
- **[HTTP Domain](./http.md)** - `RequestContext.logger` provides request-scoped logging
- **[Metrics Domain](./metrics.md)** - Logs complement metrics for observability
- **[Errors Domain](./errors.md)** - Error handlers log exceptions with context
- **[Analytics Domain](./analytics.md)** - Logging and analytics serve different purposes (transient logs vs persistent events)

## Invariants

1. **JSON Output** - All logs are valid JSON for easy parsing
2. **ISO 8601 Timestamps** - Timestamps use ISO 8601 format for consistency
3. **Context Inheritance** - Child loggers inherit parent context
4. **Level Filtering** - Logs below minimum level are suppressed (not output)
5. **Immutable Context** - Logger context is set at creation and cannot be mutated (create child loggers for new context)

## Use Cases

### Request Lifecycle Tracking

```typescript
// Middleware creates request logger
app.use((ctx, next) => {
  ctx.logger = rootLogger.child({
    request_id: ctx.request_id,
    method: ctx.request.method,
    path: ctx.request.url,
  });

  ctx.logger.info('Request started');
  return next();
});

// Handlers use request logger
async function getBooks(ctx: RequestContext) {
  ctx.logger.info('Fetching books');
  const books = await db.getBooks(ctx.sql);
  ctx.logger.info('Books fetched', { count: books.length });
  return books;
}
```

### Service Layer Logging

```typescript
class BookMetadataService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'BookMetadataService' });
  }

  async fetchMetadata(isbn: string): Promise<BookMetadata> {
    this.logger.info('Fetching metadata', { isbn });

    try {
      const metadata = await this.provider.lookup(isbn);
      this.logger.info('Metadata fetched successfully', { isbn, provider: metadata.provider });
      return metadata;
    } catch (error) {
      this.logger.error('Metadata fetch failed', {
        isbn,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
```

### Performance Monitoring

```typescript
async function queryDatabase(ctx: RequestContext, query: string) {
  const start = Date.now();

  try {
    const result = await ctx.sql.query(query);
    const duration = Date.now() - start;

    ctx.logger.info('Query executed', {
      query_type: 'select',
      duration_ms: duration,
      row_count: result.length,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    ctx.logger.error('Query failed', {
      query_type: 'select',
      duration_ms: duration,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
```

### Debug Logging in Development

```typescript
import { isDevelopment } from '@/server/src/config';

async function processBook(ctx: RequestContext, bookId: number) {
  if (isDevelopment()) {
    ctx.logger.debug('Processing book', { bookId });
  }

  const book = await fetchBook(ctx, bookId);

  if (isDevelopment()) {
    ctx.logger.debug('Book fetched', {
      bookId,
      title: book.title,
      author: book.author,
    });
  }

  return book;
}
```

## Best Practices

### 1. Use Child Loggers for Context

Create child loggers instead of adding context to every log call:

```typescript
// ❌ Bad - repeating context
logger.info('Request started', { request_id, user_id });
logger.info('Query executed', { request_id, user_id, duration_ms });

// ✅ Good - child logger with persistent context
const requestLogger = logger.child({ request_id, user_id });
requestLogger.info('Request started');
requestLogger.info('Query executed', { duration_ms });
```

### 2. Log Structured Data, Not Formatted Strings

Use the data parameter for structured fields:

```typescript
// ❌ Bad - string interpolation loses structure
logger.info(`User ${userId} created book ${bookId}`);

// ✅ Good - structured data is queryable
logger.info('User created book', { user_id: userId, book_id: bookId });
```

### 3. Include Operation Context

Add enough context to understand what operation failed:

```typescript
// ❌ Bad - unclear what failed
logger.error('Database query failed');

// ✅ Good - clear context for debugging
logger.error('Database query failed', {
  operation: 'fetchUserBooks',
  user_id: userId,
  error: error.message,
});
```

### 4. Use Appropriate Log Levels

Choose the right level for each message:

- `debug` - Variable values, function entry/exit
- `info` - Request completed, operation succeeded, state changes
- `warn` - Deprecated API usage, fallback taken, recoverable errors
- `error` - Exceptions, failures, data corruption

## Related Documentation

- [Configuration Domain](./configuration.md) - `LOG_LEVEL` environment variable
- [HTTP Domain](./http.md) - Request context with logger
- [Observability Guide](../docs/explanation/observability.md) - Logging, metrics, and tracing
