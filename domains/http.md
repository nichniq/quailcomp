# HTTP

> Request/response handling, routing, and middleware patterns for the HTTP server.

The HTTP domain defines the core abstractions for handling HTTP requests in the application. It provides type-safe routing, composable middleware, and request-scoped context that threads user identity, database connections, and logging through the request lifecycle.

Every HTTP request flows through this domain's types: from URL matching in the router, through middleware layers, to the final handler that produces a response. The domain emphasizes simplicity and type safety over framework complexity.

## Request Context

> Request-scoped context threads user identity, database access, and logging through handlers.

Traditional frameworks pass request data through global variables or framework-specific APIs. The HTTP domain uses explicit context passing: every handler receives a `RequestContext` object containing everything needed to process the request.

```typescript
import type { Sql } from "./database";
import type { Logger } from "./logging";

export type RequestContext = {
  /** Unique identifier for this request (for tracing) */
  requestId: string;

  /** Request start time in milliseconds */
  startTime: number;

  /** Authenticated user (null if unauthenticated) */
  user: AuthenticatedUser | null;

  /** Database connection */
  sql: Sql;

  /** Logger scoped to this request */
  log: Logger;

  /** URL path parameters extracted by router */
  params: Record<string, string>;
};
```

**Key Properties:**

- `requestId` - Unique ID for request tracing (generated or from `x-request-id` header)
- `startTime` - Request start timestamp for duration calculation
- `user` - Authenticated user data (populated by auth middleware)
- `sql` - Database connection (injected at context creation)
- `log` - Child logger with `requestId` for correlated logs
- `params` - URL parameters extracted by router (e.g., `{ id: "123" }` from `/api/entities/:id`)

**Context Lifecycle:**

1. **Creation** - `createContext(req, sql)` creates fresh context per request
2. **Authentication** - Auth middleware populates `user` field if JWT is valid
3. **Routing** - Router populates `params` when path parameters are matched
4. **Handler** - Handler uses context to access user, database, logging
5. **Disposal** - Context is discarded after response is sent (connection returns to pool)

## Handlers

> Handlers receive context and request, return a Response.

A handler is the fundamental unit of HTTP logic - a function that takes a request and context, performs business logic, and returns a response.

```typescript
export type Handler = (
  ctx: RequestContext,
  req: Request
) => Promise<Response> | Response;
```

**Design Philosophy:**

- **Explicit Dependencies** - Everything needed is in `ctx` or `req` (no globals)
- **Standard Types** - Uses Web API `Request` and `Response` types (not framework-specific)
- **Async-First** - Returns `Promise<Response>` for async operations, or `Response` for sync
- **Type Safety** - TypeScript ensures all required context fields are accessed safely

**Example Handler:**

```typescript
import type { Handler } from '@/domains/types/http';

const getUser: Handler = async (ctx, req) => {
  // Access authenticated user
  if (!ctx.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Use database connection from context
  const [user] = await ctx.sql`
    SELECT id, email, username, created_at
    FROM users
    WHERE id = ${ctx.user.userId}
  `;

  // Log with request-scoped logger
  ctx.log.info('User fetched', { userId: user.id });

  return new Response(JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

## Middleware

> Middleware wraps handlers to add cross-cutting concerns like auth, logging, or error handling.

Middleware is a higher-order function that takes a handler and returns a new handler, optionally augmenting the context or short-circuiting the request.

```typescript
export type Middleware = (next: Handler) => Handler;
```

**Middleware Patterns:**

1. **Before Processing** - Run logic before calling `next()` (e.g., authentication)
2. **After Processing** - Run logic after `next()` returns (e.g., logging, metrics)
3. **Short-Circuit** - Return response without calling `next()` (e.g., auth failure)
4. **Context Augmentation** - Modify `ctx` before passing to `next()` (e.g., populate `ctx.user`)

**Example Middleware:**

```typescript
import type { Middleware } from '@/domains/types/http';

// Authentication middleware: populate ctx.user from JWT
const requireAuth: Middleware = (next) => {
  return async (ctx, req) => {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return new Response('Missing token', { status: 401 });
    }

    try {
      const user = await verifyJWT(token);
      ctx.user = user; // Augment context
      return next(ctx, req); // Continue to handler
    } catch (error) {
      return new Response('Invalid token', { status: 401 });
    }
  };
};

// Logging middleware: log request/response
const requestLogger: Middleware = (next) => {
  return async (ctx, req) => {
    ctx.log.info('Request started', { method: req.method, url: req.url });

    const response = await next(ctx, req);

    const duration = Date.now() - ctx.startTime;
    ctx.log.info('Request completed', { status: response.status, duration });

    return response;
  };
};
```

**Composing Middleware:**

Middleware composes right-to-left (innermost middleware runs first):

```typescript
const handler = requireAuth(requestLogger(getUser));
// Request flow: requireAuth → requestLogger → getUser
```

## Routing

> Path-based routing with parameter extraction and method-specific handlers.

The router matches incoming requests to handlers based on HTTP method and URL path, extracting path parameters along the way.

```typescript
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export type Route = {
  method: HttpMethod;
  path: string;
  handler: Handler;
  middleware?: Middleware[];
};

export type RouteMatch = {
  route: Route;
  params: Record<string, string>;
};
```

**Path Patterns:**

- **Static:** `/api/books` - Exact match only
- **Parameters:** `/api/books/:id` - Matches `/api/books/123`, extracts `{ id: "123" }`
- **Multiple Parameters:** `/api/authors/:authorId/books/:bookId`

**Router API:**

```typescript
const router = createRouter();

// Add routes
router.get('/api/books', listBooks);
router.get('/api/books/:id', getBook);
router.post('/api/books', createBook, [requireAuth]);
router.put('/api/books/:id', updateBook, [requireAuth]);
router.delete('/api/books/:id', deleteBook, [requireAuth, requireAdmin]);

// Match request
const match = router.match('GET', '/api/books/123');
// match = { route: {...}, params: { id: '123' } }
```

## Authenticated User

> User identity extracted from JWT and attached to request context.

When a request includes a valid JWT, the authentication middleware extracts user information and populates `ctx.user`.

```typescript
export type AuthenticatedUser = {
  userId: number;         // Primary key from users table
  email: string;          // User's email address
  username: string | null; // Username (may be null)
  credentialId: number;   // Which credential was used (for multi-credential users)
  authMethod: string;     // How they authenticated (e.g., 'password', 'google')
};
```

**Authentication Flow:**

1. Client sends JWT in `Authorization: Bearer <token>` header
2. Auth middleware extracts and verifies JWT
3. JWT payload is decoded to `AuthenticatedUser`
4. `ctx.user` is populated with user data
5. Handler accesses `ctx.user` to perform authorized operations

**Usage in Handlers:**

```typescript
const createBook: Handler = async (ctx, req) => {
  // Require authentication
  if (!ctx.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const data = await req.json();

  // Use authenticated user ID
  const [book] = await ctx.sql`
    INSERT INTO books (user_id, title, author)
    VALUES (${ctx.user.userId}, ${data.title}, ${data.author})
    RETURNING *
  `;

  return new Response(JSON.stringify(book), { status: 201 });
};
```

## Usage Examples

### Basic Route Handler

```typescript
import type { Handler } from '@/domains/types/http';

const healthCheck: Handler = async (ctx, req) => {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### Handler with Path Parameters

```typescript
import type { Handler } from '@/domains/types/http';

const getBook: Handler = async (ctx, req) => {
  const bookId = parseInt(ctx.params.id, 10); // From /api/books/:id

  const [book] = await ctx.sql`
    SELECT * FROM books WHERE id = ${bookId}
  `;

  if (!book) {
    return new Response('Book not found', { status: 404 });
  }

  return new Response(JSON.stringify(book), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### Handler with Request Body

```typescript
import type { Handler } from '@/domains/types/http';

const createBook: Handler = async (ctx, req) => {
  if (!ctx.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const data = await req.json();

  // Validate input
  if (!data.title || !data.author) {
    return new Response('Missing required fields', { status: 400 });
  }

  const [book] = await ctx.sql`
    INSERT INTO books (user_id, title, author)
    VALUES (${ctx.user.userId}, ${data.title}, ${data.author})
    RETURNING *
  `;

  return new Response(JSON.stringify(book), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### Building a Router

```typescript
import { createRouter } from '@/server/src/router';
import type { Handler } from '@/domains/types/http';

const router = createRouter();

// Public routes
router.get('/health', healthCheck);
router.post('/auth/login', login);

// Protected routes with middleware
router.get('/api/books', listBooks, [requireAuth]);
router.post('/api/books', createBook, [requireAuth]);
router.get('/api/books/:id', getBook, [requireAuth]);
router.put('/api/books/:id', updateBook, [requireAuth]);
router.delete('/api/books/:id', deleteBook, [requireAuth, requireAdmin]);

// Admin routes
router.get('/admin/users', listUsers, [requireAuth, requireAdmin]);
```

### Request Lifecycle

```typescript
import { createContext } from '@/server/src/context';
import { getConnection } from '@quailcomp/data';

// 1. Create context for incoming request
const sql = getConnection();
const ctx = createContext(req, sql);

// 2. Match request to route
const match = router.match(req.method, new URL(req.url).pathname);

if (!match) {
  return new Response('Not Found', { status: 404 });
}

// 3. Populate params from route match
ctx.params = match.params;

// 4. Compose middleware and handler
let handler = match.route.handler;
for (const middleware of match.route.middleware ?? []) {
  handler = middleware(handler);
}

// 5. Execute handler
const response = await handler(ctx, req);

// 6. Return response
return response;
```

## Integration Points

- **[Configuration Domain](./configuration.md)** - Server host and port come from `env.HOST` and `env.PORT`
- **[Database Domain](./database.md)** - `RequestContext.sql` provides database connection
- **[Logging Domain](./logging.md)** - `RequestContext.log` provides request-scoped logger
- **[Authentication Domain](./authentication.md)** - Provides JWT verification to populate `ctx.user`
- **[Authorization Domain](./authorization.md)** - Uses `ctx.user` to check permissions
- **[Errors Domain](./errors.md)** - Error middleware catches exceptions and returns `ErrorResponse`
- **[Metrics Domain](./metrics.md)** - Middleware records HTTP request metrics
- **[WebSocket Domain](./websocket.md)** - WebSocket upgrade uses HTTP request/context patterns

## Invariants

1. **Context Per Request** - Every request gets a fresh `RequestContext` (no shared state between requests)
2. **Immutable Context** - Context fields should not be reassigned after creation (except `user` and `params` by middleware/router)
3. **Request ID Tracing** - Every request has a unique `requestId` for log correlation
4. **Database Connection Pooling** - `ctx.sql` comes from connection pool (not a dedicated connection per request)
5. **Handler Signature** - All handlers must match `(ctx, req) => Response | Promise<Response>`
6. **Middleware Composition** - Middleware composes in reverse order (innermost runs first)
7. **Path Parameter Decoding** - URL-encoded path parameters are automatically decoded

## Use Cases

### Public API Endpoints

```typescript
// No authentication required
router.get('/api/health', healthCheck);
router.get('/api/books/search', searchBooks); // Public search
```

### Protected API Endpoints

```typescript
// Require authentication
router.get('/api/profile', getProfile, [requireAuth]);
router.put('/api/profile', updateProfile, [requireAuth]);
```

### Admin-Only Endpoints

```typescript
// Require admin role
router.delete('/api/users/:id', deleteUser, [requireAuth, requireAdmin]);
router.get('/admin/metrics', getMetrics, [requireAuth, requireAdmin]);
```

### Request Logging and Metrics

```typescript
// Apply logging/metrics to all routes
const withObservability = (handler: Handler): Handler => {
  return requestLogger(metricsMiddleware(handler));
};

router.get('/api/books', withObservability(listBooks));
```

### Error Handling

```typescript
// Wrap all routes with error handling
const withErrorHandling: Middleware = (next) => {
  return async (ctx, req) => {
    try {
      return await next(ctx, req);
    } catch (error) {
      ctx.log.error('Handler error', { error });
      return new Response(
        JSON.stringify({ error: 'Internal Server Error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
};

router.get('/api/books', listBooks, [withErrorHandling]);
```

### Custom Middleware for Rate Limiting

```typescript
const rateLimit: Middleware = (next) => {
  const requests = new Map<string, number>();

  return async (ctx, req) => {
    const key = ctx.user?.userId.toString() ?? ctx.requestId;
    const count = requests.get(key) ?? 0;

    if (count >= 100) {
      return new Response('Too Many Requests', { status: 429 });
    }

    requests.set(key, count + 1);
    setTimeout(() => requests.delete(key), 60_000); // Reset after 1 min

    return next(ctx, req);
  };
};

router.post('/api/books', createBook, [requireAuth, rateLimit]);
```

## Related Documentation

- [Bun HTTP Server](https://bun.sh/docs/api/http) - Bun's native HTTP server API
- [Web API Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) - Standard Request type
- [Web API Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) - Standard Response type
