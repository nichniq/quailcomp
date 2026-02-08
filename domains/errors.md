# Errors

> Standardized error handling with type-safe error codes and structured responses for HTTP and database errors.

The Errors domain defines how the application represents, handles, and communicates failures. It provides standard error response formats for HTTP APIs and typed error classes for database operations. Consistent error handling enables clients to parse and handle errors programmatically while providing developers with rich context for debugging.

Errors are central to reliability - every failure path uses these types to ensure consistent error reporting across the system.

## HTTP Error Responses

> Standard JSON error response format for all API endpoints.

All HTTP errors return a consistent JSON structure with error message, code, and optional details:

```typescript
export type ErrorResponse = {
  /** Human-readable error message */
  error: string;

  /** Machine-readable error code (UPPER_SNAKE_CASE) */
  code: string;

  /** Optional additional details (validation errors, context, etc.) */
  details?: Record<string, unknown>;

  /** The request path where the error occurred */
  path?: string;

  /** Request ID for tracking */
  requestId?: string;
};
```

**Example Response:**

```json
{
  "error": "User not found",
  "code": "NOT_FOUND",
  "path": "/api/users/123",
  "requestId": "req_abc123"
}
```

## Validation Errors

> Field-level validation errors with structured details.

When request validation fails, the response includes details about which fields are invalid:

```typescript
export type ValidationErrorDetail = {
  field: string; // Field path (e.g., 'email', 'book.title')
  message: string; // Human-readable validation error
  value?: unknown; // The invalid value (if safe to include)
};

export type ValidationErrorResponse = ErrorResponse & {
  code: "VALIDATION_ERROR";
  details: {
    fields: ValidationErrorDetail[];
  };
};
```

**Example Response:**

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": [
      { "field": "email", "message": "Email is required" },
      { "field": "password", "message": "Password must be at least 12 characters" }
    ]
  },
  "path": "/api/auth/register",
  "requestId": "req_xyz789"
}
```

## Database Error Codes

> Enum of database error types for type-safe error handling.

Database errors are categorized into specific types:

```typescript
export type DatabaseErrorCode =
  | "UNIQUE_VIOLATION" // Duplicate key (e.g., email already exists)
  | "FOREIGN_KEY_VIOLATION" // Referenced entity doesn't exist
  | "NOT_NULL_VIOLATION" // Required field is null
  | "CHECK_VIOLATION" // Check constraint failed
  | "CONNECTION_ERROR" // Cannot connect to database
  | "QUERY_ERROR" // Invalid SQL or query execution failed
  | "NOT_FOUND" // Entity or event not found
  | "UNKNOWN_ERROR"; // Unclassified error
```

## Database Error Classes

> Typed error classes provide rich context for database failures.

The error handling system uses a hierarchy of error classes defined in `/data/client/src/errors.ts`:

**Base Error Class:**

- `DatabaseError` - Base class with code, operation, details, and cause fields

**Specialized Error Classes:**

- `EntityNotFoundError` - Entity lookup failed (extends DatabaseError)
- `EventNotFoundError` - Event lookup failed (extends DatabaseError)
- `UniqueViolationError` - Duplicate key constraint violation (extends DatabaseError)
- `ForeignKeyViolationError` - Referenced entity doesn't exist (extends DatabaseError)
- `NotNullViolationError` - Required field is null (extends DatabaseError)
- `CheckViolationError` - Check constraint failed (extends DatabaseError)

These classes are imported from the source code rather than defined in this domain document.

## PostgreSQL Error Parsing

> Parse PostgreSQL error codes into typed error classes.

The `parseDatabaseError` function converts PostgreSQL errors into typed DatabaseError instances:

```typescript
export type DatabaseErrorParser = (error: unknown, operation: string) => Error;
```

**PostgreSQL Error Code Mapping:**

- `23505` → UniqueViolationError
- `23503` → ForeignKeyViolationError
- `23502` → NotNullViolationError
- `23514` → CheckViolationError
- `ECONNREFUSED`, `ENOTFOUND` → DatabaseError with CONNECTION_ERROR code

## Usage Examples

### HTTP Error Responses

```typescript
import type { ErrorResponse } from '@/domains/types/errors';
import type { RequestContext } from '@/server/src/context';

// Return error response from handler
async function handleGetUser(ctx: RequestContext): Promise<Response> {
  const userId = parseInt(ctx.params.id);

  try {
    const user = await getUserById(ctx.sql, userId);
    return new Response(JSON.stringify(user));
  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'User not found',
      code: 'NOT_FOUND',
      path: ctx.request.url,
      requestId: ctx.request_id,
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

### Validation Error Responses

```typescript
import type { ValidationErrorResponse, ValidationErrorDetail } from '@/domains/types/errors';

async function handleCreateBook(ctx: RequestContext): Promise<Response> {
  const body = await ctx.request.json();

  const errors: ValidationErrorDetail[] = [];

  if (!body.title) {
    errors.push({ field: 'title', message: 'Title is required' });
  }

  if (!body.isbn) {
    errors.push({ field: 'isbn', message: 'ISBN is required' });
  } else if (!/^\d{13}$/.test(body.isbn)) {
    errors.push({ field: 'isbn', message: 'ISBN must be 13 digits', value: body.isbn });
  }

  if (errors.length > 0) {
    const errorResponse: ValidationErrorResponse = {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: { fields: errors },
      path: ctx.request.url,
      requestId: ctx.request_id,
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Proceed with valid data
  const book = await createBook(ctx.sql, body);
  return new Response(JSON.stringify(book), { status: 201 });
}
```

### Database Error Handling

```typescript
import { parseDatabaseError, EntityNotFoundError, UniqueViolationError } from '@/data/client/src/errors';
import type { Sql } from '@/domains/types/database';

async function createUser(sql: Sql, email: string, username: string) {
  try {
    const result = await sql`
      INSERT INTO users (email, username)
      VALUES (${email}, ${username})
      RETURNING *
    `;
    return result[0];
  } catch (error) {
    const dbError = parseDatabaseError(error, 'createUser');

    if (dbError instanceof UniqueViolationError) {
      if (dbError.constraint.includes('email')) {
        throw new Error('Email already in use');
      }
      if (dbError.constraint.includes('username')) {
        throw new Error('Username already taken');
      }
    }

    throw dbError;
  }
}
```

### Graceful Error Recovery

```typescript
import { EntityNotFoundError } from '@/data/client/src/errors';

async function getBookOrNull(sql: Sql, bookId: number): Promise<Book | null> {
  try {
    return await getBookById(sql, bookId);
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      return null; // Graceful fallback
    }
    throw error; // Re-throw unexpected errors
  }
}
```

### Error Logging with Context

```typescript
import { parseDatabaseError } from '@/data/client/src/errors';
import type { Logger } from '@/domains/types/logging';

async function updateBook(sql: Sql, logger: Logger, bookId: number, updates: Partial<Book>) {
  try {
    const result = await sql`
      UPDATE books
      SET ${sql(updates)}
      WHERE book_id = ${bookId}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new EntityNotFoundError(bookId, 'book');
    }

    return result[0];
  } catch (error) {
    const dbError = parseDatabaseError(error, 'updateBook');

    logger.error('Failed to update book', {
      book_id: bookId,
      error_code: dbError.code,
      error_message: dbError.message,
      operation: dbError.operation,
      details: dbError.details,
    });

    throw dbError;
  }
}
```

## Integration Points

- **[HTTP Domain](./http.md)** - Error responses used in HTTP handlers and middleware
- **[Database Domain](./database.md)** - Database errors parsed from PostgreSQL errors
- **[Entities Domain](./entities.md)** - EntityNotFoundError thrown by entity operations
- **[Events Domain](./events.md)** - EventNotFoundError thrown by event operations
- **[Authentication Domain](./authentication.md)** - AuthError types for authentication failures
- **[Logging Domain](./logging.md)** - Errors logged with structured context

## Invariants

1. **Consistent Format** - All HTTP errors use ErrorResponse structure
2. **Machine-Readable Codes** - Error codes are UPPER_SNAKE_CASE for programmatic handling
3. **Error Wrapping** - Original errors are preserved in `cause` field for debugging
4. **Type Safety** - Error parsing converts PostgreSQL errors to typed classes
5. **Request Tracking** - Error responses include request ID for correlation with logs

## Use Cases

### Client-Side Error Handling

```typescript
// Client code parsing error responses
async function fetchBooks() {
  const response = await fetch('/api/books');

  if (!response.ok) {
    const error: ErrorResponse = await response.json();

    switch (error.code) {
      case 'VALIDATION_ERROR':
        // Show field-level validation errors
        const validationError = error as ValidationErrorResponse;
        displayFieldErrors(validationError.details.fields);
        break;

      case 'NOT_FOUND':
        // Show not found message
        showError('Books not found');
        break;

      case 'UNAUTHORIZED':
        // Redirect to login
        redirectToLogin();
        break;

      default:
        // Generic error handling
        showError(error.error);
    }
  }

  return response.json();
}
```

### Retry Logic for Transient Errors

```typescript
import { parseDatabaseError } from '@/data/client/src/errors';

async function queryWithRetry<T>(sql: Sql, query: string, maxRetries = 3): Promise<T[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await sql.query<T>(query);
    } catch (error) {
      const dbError = parseDatabaseError(error, 'query');

      // Retry on connection errors
      if (dbError.code === 'CONNECTION_ERROR' && attempt < maxRetries - 1) {
        await sleep(1000 * Math.pow(2, attempt)); // Exponential backoff
        continue;
      }

      throw dbError;
    }
  }

  throw new Error('Max retries exceeded');
}
```

### Error Metrics Tracking

```typescript
import { metrics } from '@/server/src/metrics/collector';
import { parseDatabaseError } from '@/data/client/src/errors';

async function executeQuery(sql: Sql, query: string) {
  try {
    return await sql.query(query);
  } catch (error) {
    const dbError = parseDatabaseError(error, 'query');

    // Track error metrics by type
    metrics.inc('database_errors_total', {
      error_code: dbError.code,
      operation: dbError.operation,
    });

    throw dbError;
  }
}
```

## Related Documentation

- [HTTP Domain](./http.md) - Error response format in HTTP handlers
- [Database Domain](./database.md) - Database error handling
- [Logging Domain](./logging.md) - Logging errors with context
- [Error Handling Guide](../docs/explanation/error-handling.md) - Best practices for error handling
