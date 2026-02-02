# Server Source Code

Core server implementation for the Quailcomp API.

## Directory Structure

- [`auth/`](auth/) - Authentication and authorization
- [`authz/`](authz/) - Authorization service and middleware
- [`analytics/`](analytics/) - Event tracking and analytics
- [`logging/`](logging/) - Structured logging with Pino
- [`metrics/`](metrics/) - Prometheus metrics collection
- [`middleware/`](middleware/) - HTTP middleware components
- [`observability/`](observability/) - Error tracking with Sentry
- [`openapi/`](openapi/) - OpenAPI 3.0 specification generation
- [`routes/`](routes/) - API route handlers
- [`utils/`](utils/) - Import/export utilities
- [`websocket/`](websocket/) - WebSocket real-time updates

## Core Files

- [`config.ts`](config.ts) - Environment configuration
- [`context.ts`](context.ts) - Request context creation
- [`router.ts`](router.ts) - HTTP routing
- [`server.ts`](server.ts) - Server setup and middleware stack
- [`index.ts`](index.ts) - Application entry point

## Architecture

The server follows a layered architecture:

1. **Entry Point** (`index.ts`) - Initializes Sentry, creates server, handles graceful shutdown
2. **Server Setup** (`server.ts`) - Configures Bun HTTP server, WebSocket handler, middleware stack
3. **Router** (`router.ts`) - Matches HTTP requests to handlers
4. **Routes** (`routes/`) - Business logic for API endpoints
5. **Middleware** (`middleware/`) - Cross-cutting concerns (auth, logging, metrics, CORS)
6. **Services** - Domain services (auth, authorization, analytics)

## Request Flow

```text
Request
  → Entry Point (index.ts)
  → Server (server.ts)
    → Router (router.ts)
    → Middleware Stack
      → Error Handler
      → HTTPS Redirect
      → Security Headers
      → Request ID
      → Request Logger
      → Request Metrics
      → CORS
    → Route Handler (routes/)
      → Auth Middleware (if protected)
      → Business Logic
      → Database Operations
      → Response
```

## WebSocket Flow

```text
WebSocket Connection
  → Server (server.ts) - Upgrade request at /ws
  → WebSocket Handler (websocket/server.ts)
    → Open - Send auth_required
    → Message
      → authenticate - Verify JWT token
      → subscribe - Check authorization, add to subscriptions
      → unsubscribe - Remove from subscriptions
      → ping - Respond with pong
    → Close - Clean up client

Entity Mutation (via HTTP)
  → Route Handler (e.g., routes/books.ts)
  → Update Entity in Database
  → Broadcast Update (websocket/server.ts)
    → Find subscribed clients
    → Send update message to each
```

## Configuration

Configuration is loaded from environment variables in [`config.ts`](config.ts):

- `PORT` - HTTP server port (default: 3000)
- `HOST` - Server hostname (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - JWT signing secret
- `DATABASE_URL` - PostgreSQL connection string
- `SENTRY_DSN` - Sentry error tracking endpoint

See [Environment Variables Reference](../../docs/reference/environment-variables.md) for complete list.

## Middleware

Middleware functions wrap handlers to add cross-cutting functionality:

- **Error Handler** - Catches errors and returns appropriate responses
- **HTTPS Redirect** - Redirects HTTP to HTTPS in production
- **Security Headers** - Adds security headers (CSP, HSTS, etc.)
- **Request ID** - Generates unique ID for request tracking
- **Request Logger** - Logs request lifecycle events
- **Request Metrics** - Records latency and status metrics
- **CORS** - Handles cross-origin requests
- **Auth Middleware** - Verifies JWT tokens, checks permissions

## Testing

Tests are in [`../tests/`](../tests/). See [Server Tests README](../tests/README.md) for details.

```bash
# Run all server tests
bun test

# Run specific test file
bun test tests/auth.test.ts

# Run with coverage
bun test --coverage
```

## Development

```bash
# Install dependencies
bun install

# Run server in development mode
bun run dev

# Run tests in watch mode
bun test --watch

# Type check
bun run typecheck

# Lint code
bun run lint
```
