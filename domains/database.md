# Database

> PostgreSQL connection management using Bun's native SQL client with automatic parameterization.

The Database domain provides low-level PostgreSQL database connectivity for the application. It manages connection pooling, URL construction, and lifecycle management through Bun's built-in SQL client, which offers native PostgreSQL support with tagged template literals for safe query execution.

Every database query in the application flows through this domain's connection management. The singleton pattern ensures efficient resource usage while providing flexibility for testing scenarios that require isolated connections.

## Bun SQL Client

> Bun provides native PostgreSQL support with tagged template literals for automatic parameterization and SQL injection protection.

Traditional database clients require separate libraries and configuration. Bun's built-in SQL client simplifies this by:

1. **Native Integration** - No external dependencies like `pg` or `postgres`
2. **Tagged Templates** - Safe parameterization through template literals: `` sql`SELECT * FROM users WHERE id = ${userId}` ``
3. **Connection Pooling** - Built-in connection pool management with configurable size
4. **Type Safety** - TypeScript-first design with type inference
5. **camelCase Conversion** - Automatic conversion of snake_case columns to camelCase (configurable)

```typescript
import type { SQL } from "bun";

export type Sql = SQL;
```

The `Sql` type is re-exported from Bun's SQL class. It provides methods for executing queries, managing transactions, and controlling connection lifecycle.

**Key Methods:**

- `` sql`...` `` - Execute a query with automatic parameterization
- `sql.begin()` - Start a transaction
- `sql.close()` - Close the connection pool

## Database Configuration

> Connection settings are loaded from environment variables with sensible defaults for development.

Database connections are configured through environment variables, allowing different settings per environment without code changes.

```typescript
export type DbConfig = {
  host: string;           // Database server hostname
  port: number;           // PostgreSQL port (typically 5432)
  database: string;       // Database name
  username: string;       // Database user
  password: string;       // Database password
  ssl: boolean;           // Enable SSL/TLS for connection
  max: number;            // Maximum connections in pool
};
```

**Environment Variables:**

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: quailcomp)
- `DB_USER` - Database user (default: quailcomp_app)
- `DB_PASSWORD` - Database password (required in production)
- `DB_SSL` - Enable SSL (default: false for local, true for production)
- `DB_MAX_CONNECTIONS` - Maximum pool size (default: 10)

**Test Configuration:** The `getTestDbConfig()` function returns configuration for a separate test database (`quailcomp_test` by default), preventing tests from polluting development data.

## Connection Management

> A singleton connection pattern provides efficient resource usage while supporting custom connections for testing.

The Database domain provides three approaches to connection management:

### 1. Default Singleton Connection

The most common pattern for application code:

```typescript
import { getConnection } from '@/data/client/src/db/connection';

const sql = getConnection(); // Always returns the same connection
const users = await sql`SELECT * FROM users WHERE email = ${email}`;
```

**Benefits:**

- Automatic connection pooling
- Efficient resource usage (one pool for the app)
- No manual lifecycle management

**Drawback:**

- Shared state between tests (use custom connections in tests instead)

### 2. Custom Connections

For testing or scenarios requiring isolated connections:

```typescript
import { createConnection } from '@/data/client/src/db/connection';

const sql = createConnection({
  host: 'localhost',
  port: 5432,
  database: 'my_test_db',
  username: 'test_user',
  password: 'test_password',
  ssl: false,
  max: 5,
});

// Use the connection
await sql`SELECT 1`;

// Clean up when done
await sql.close();
```

**Benefits:**

- Full control over connection settings
- Isolated connection pool per instance
- Useful for parallel test execution

**Drawback:**

- Manual lifecycle management (must call `sql.close()`)

### 3. Graceful Shutdown

For clean application shutdown:

```typescript
import { closeConnection } from '@/data/client/src/db/connection';

// On shutdown signal
process.on('SIGTERM', async () => {
  await closeConnection(); // Closes the default connection pool
  process.exit(0);
});
```

## Connection URL Construction

> Connection URLs are built from configuration with proper encoding and SSL parameter handling.

The `buildConnectionUrl()` function (internal) constructs PostgreSQL connection URLs from `DbConfig`:

**Format:** `postgres://username:password@host:port/database?sslmode=require`

**URL Encoding:** Passwords are properly URL-encoded to handle special characters.

**SSL Handling:** When `ssl: true`, the `?sslmode=require` parameter is appended.

**Example:**

```typescript
// Config:
const config = {
  host: 'db.example.com',
  port: 5432,
  database: 'quailcomp',
  username: 'app_user',
  password: 'p@ssw0rd!',
  ssl: true,
  max: 10,
};

// Generated URL:
// postgres://app_user:p%40ssw0rd!@db.example.com:5432/quailcomp?sslmode=require
```

## Usage Examples

### Basic Query Execution

```typescript
import { getConnection } from '@/data/client/src/db/connection';

const sql = getConnection();

// Simple query
const result = await sql`SELECT * FROM books WHERE id = ${bookId}`;

// Insert with RETURNING
const [newBook] = await sql`
  INSERT INTO books (title, author, isbn)
  VALUES (${title}, ${author}, ${isbn})
  RETURNING *
`;

// Update
await sql`
  UPDATE books
  SET status = ${newStatus}
  WHERE id = ${bookId}
`;
```

### Transaction Handling

```typescript
import { getConnection } from '@/data/client/src/db/connection';

const sql = getConnection();

await sql.begin(async (tx) => {
  // All queries in this block use the same transaction
  const [user] = await tx`
    INSERT INTO users (email, name)
    VALUES (${email}, ${name})
    RETURNING id
  `;

  await tx`
    INSERT INTO user_roles (user_id, role)
    VALUES (${user.id}, ${'reader'})
  `;

  // Transaction commits automatically if no errors
  // Rolls back automatically on error
});
```

### Testing with Isolated Connections

```typescript
import { createConnection, getTestDbConfig } from '@/data/client/src/db/connection';
import { test, afterAll } from 'bun:test';

const sql = createConnection(getTestDbConfig());

afterAll(async () => {
  await sql.close(); // Clean up connection pool
});

test('user creation', async () => {
  const [user] = await sql`
    INSERT INTO users (email, name)
    VALUES (${'test@example.com'}, ${'Test User'})
    RETURNING *
  `;

  expect(user.email).toBe('test@example.com');
});
```

### Environment-Specific Configuration

```typescript
import { getConnection } from '@/data/client/src/db/connection';

const sql = getConnection();

// Connection automatically uses environment-specific settings:
// - Development: DB_NAME=quailcomp, DB_HOST=localhost
// - Production: DB_NAME=quailcomp_prod, DB_HOST=prod.db.example.com, DB_SSL=true
// - Test: DB_NAME=quailcomp_test
```

## Integration Points

- **[Configuration Domain](./configuration.md)** - Provides `DATABASE_URL` and database configuration through environment variables
- **[Entities Domain](./entities.md)** - Uses `Sql` connections for mutable entity storage operations
- **[Events Domain](./events.md)** - Uses `Sql` connections for immutable event recording
- **[Errors Domain](./errors.md)** - Database errors (unique violations, foreign key violations) are caught and transformed into domain errors
- **[HTTP Domain](./http.md)** - `RequestContext` includes an `sql` connection for request-scoped database operations

## Invariants

1. **Singleton Connection** - `getConnection()` always returns the same connection instance for the application
2. **Connection Pooling** - All connections use connection pooling with a maximum pool size from configuration
3. **Automatic Parameterization** - Tagged template queries automatically parameterize values, preventing SQL injection
4. **camelCase Columns** - Column names are automatically converted from snake_case to camelCase in query results
5. **Resource Cleanup** - Connections must be closed (either through `closeConnection()` or `sql.close()`) to prevent resource leaks
6. **Test Isolation** - Test databases use separate database names to avoid polluting development data

## Use Cases

### Application Startup

```typescript
// Main application entry point
import { getConnection } from '@/data/client/src/db/connection';

// Connection is created lazily on first call
const sql = getConnection();

// Verify database connectivity at startup
try {
  await sql`SELECT 1`;
  console.log('Database connection established');
} catch (error) {
  console.error('Failed to connect to database:', error);
  process.exit(1);
}
```

### Request-Scoped Database Access

```typescript
// HTTP handler with database access
import type { Handler } from '@/server/src/middleware/types';

const getUserBooks: Handler = async (ctx, req) => {
  const { sql } = ctx; // Connection from RequestContext

  const books = await sql`
    SELECT * FROM books
    WHERE user_id = ${ctx.user.id}
    ORDER BY created_at DESC
  `;

  return new Response(JSON.stringify(books), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### Migration Execution

```typescript
// Database migration script
import { getConnection } from '@/data/client/src/db/connection';

const sql = getConnection();

// Execute migration
await sql`
  CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

console.log('Migration completed');
await sql.close();
```

### Parallel Test Execution

```typescript
// Test file with isolated connection
import { createConnection, getTestDbConfig } from '@/data/client/src/db/connection';

const sql = createConnection({
  ...getTestDbConfig(),
  database: `quailcomp_test_${Date.now()}`, // Unique DB per test file
});

test('parallel test 1', async () => {
  // Each test file has its own connection pool
  await sql`INSERT INTO books (title) VALUES (${'Book 1'})`;
});

afterAll(async () => {
  await sql.close();
});
```

## Related Documentation

- [Database Roles](../docs/explanation/database-roles.md) - Explanation of `quailcomp_owner` vs `quailcomp_app` roles
- [Development Setup](../docs/how-to/setup-development.md) - Database setup instructions
- [Run Migrations](../docs/how-to/run-migrations.md) - How to run database migrations
- [Bun SQL Documentation](https://bun.sh/docs/api/sql) - Official Bun SQL API reference
