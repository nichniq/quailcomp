# Configuration

> Runtime environment configuration with type-safe validation using Zod.

The Configuration domain manages all environment variables and runtime settings for the application. Every environment variable is validated at startup using Zod schemas, ensuring type safety and catching configuration errors before the application begins handling requests.

Configuration is the foundation of the system - it determines how the server runs, which features are enabled, and how components connect to external services. A single `env` object provides type-safe access to all configuration throughout the application.

## Environment Validation

> Zod schemas validate environment variables at startup, providing compile-time type safety and runtime validation.

Traditional environment variable access (`process.env.PORT`) is untyped and error-prone. The Configuration domain uses Zod to:

1. **Validate format** - Ensure DATABASE_URL is a valid URL, PORT is a positive integer, etc.
2. **Provide defaults** - Missing optional variables get sensible defaults (PORT defaults to 3000)
3. **Fail fast** - Invalid configuration throws an error at startup, not during request handling
4. **Enable type safety** - The `Env` type provides autocomplete and type checking

```typescript
export type Env = {
  // Node environment
  NODE_ENV: 'development' | 'production' | 'test';

  // Server configuration
  PORT: number;
  HOST: string;

  // Database
  DATABASE_URL: string;

  // Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_SECRET_OLD?: string;

  // CORS
  CORS_ORIGINS: string;

  // Rate limiting
  RATE_LIMIT_ENABLED: boolean;

  // Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';

  // Book metadata providers (optional)
  GOOGLE_BOOKS_API_KEY?: string;
  OPEN_LIBRARY_API_KEY?: string;

  // Analytics
  ANALYTICS_ENABLED: boolean;
  ANALYTICS_RETENTION_DAYS: number;

  // Observability
  SENTRY_DSN?: string;
  SENTRY_ENABLED: boolean;
  PROMETHEUS_ENABLED: boolean;

  // Security
  PASSWORD_MIN_LENGTH: number;
  PASSWORD_REQUIRE_COMPLEXITY: boolean;
  HTTPS_REDIRECT: boolean;
};
```

## Environment Helpers

> Utility functions provide readable environment checks.

Instead of checking `env.NODE_ENV === 'production'` everywhere, helper functions make code more readable:

```typescript
export type EnvironmentCheck = () => boolean;
```

**Usage:**

```typescript
import { env, isProduction, isDevelopment, isTest } from '@/domains/types/configuration';

// Type-safe access to configuration
const port = env.PORT; // number
const dbUrl = env.DATABASE_URL; // string

// Readable environment checks
if (isProduction()) {
  // Enable production optimizations
}

if (isDevelopment()) {
  // Enable development tools
}

if (isTest()) {
  // Use test doubles
}
```

## Configuration Categories

### Server Configuration

Controls how the HTTP server listens for requests.

- `PORT` - Server port (default: 3000)
- `HOST` - Bind address (default: 0.0.0.0 for all interfaces)
- `NODE_ENV` - Environment mode (development, production, test)

### Database Configuration

Connection settings for PostgreSQL.

- `DATABASE_URL` - PostgreSQL connection URL (required, validated as URL)

**Example:** `postgres://user:password@localhost:5432/quailcomp`

### Authentication Configuration

JWT token settings and secret management.

- `JWT_SECRET` - Secret key for signing JWTs (minimum 32 characters, required)
- `JWT_EXPIRES_IN` - Token expiration time (default: '7d')
- `JWT_SECRET_OLD` - Previous secret key for rotation grace period (optional)

**Secret Rotation:** When rotating JWT secrets, set `JWT_SECRET_OLD` to the previous secret. This allows tokens signed with the old secret to remain valid during the transition period.

### CORS Configuration

Cross-Origin Resource Sharing settings.

- `CORS_ORIGINS` - Allowed origins for cross-origin requests (default: '<http://localhost:5173>')

**Multiple Origins:** Separate multiple origins with commas: `http://localhost:5173,https://app.example.com`

### Rate Limiting Configuration

API rate limit settings.

- `RATE_LIMIT_ENABLED` - Enable/disable rate limiting (default: true)

### Logging Configuration

Logging verbosity and output settings.

- `LOG_LEVEL` - Minimum log level to output (default: 'info')
  - `error` - Only critical errors
  - `warn` - Warnings and errors
  - `info` - Informational messages, warnings, and errors
  - `debug` - All messages including debug output

### External Service Configuration

API keys for third-party services.

- `GOOGLE_BOOKS_API_KEY` - Google Books API key (optional)
- `OPEN_LIBRARY_API_KEY` - Open Library API key (optional)

**Graceful Degradation:** Book metadata services check for API keys and skip providers that lack credentials.

### Analytics Configuration

Analytics event collection settings.

- `ANALYTICS_ENABLED` - Enable/disable analytics collection (default: true)
- `ANALYTICS_RETENTION_DAYS` - Days to retain analytics events (default: 90)

### Observability Configuration

Error tracking and metrics export.

- `SENTRY_DSN` - Sentry error tracking DSN (optional)
- `SENTRY_ENABLED` - Enable/disable Sentry integration (default: false)
- `PROMETHEUS_ENABLED` - Enable/disable Prometheus metrics endpoint (default: true)

### Security Configuration

Password policy and HTTPS enforcement.

- `PASSWORD_MIN_LENGTH` - Minimum password length (default: 12, minimum 8)
- `PASSWORD_REQUIRE_COMPLEXITY` - Require uppercase, lowercase, number, and special character (default: true)
- `HTTPS_REDIRECT` - Redirect HTTP requests to HTTPS in production (default: true)

## Test Environment Handling

> Test environment uses safe defaults to avoid validation errors.

In test mode (`NODE_ENV=test`), the configuration system provides sensible defaults for required values. This allows tests to run without a `.env` file while still allowing test-specific overrides through environment variables.

**Test Environment Defaults:**

- `NODE_ENV`: 'test'
- `DATABASE_URL`: 'postgres://localhost/quailcomp_test'
- `JWT_SECRET`: 'test-secret-key-minimum-32-characters-long-for-testing'

## Validation Errors

When configuration validation fails, the application throws a ZodError at startup with details about which variables are invalid:

**Example Validation Errors:**

- Missing required variable: "DATABASE_URL is required"
- Invalid format: "DATABASE_URL must be a valid PostgreSQL URL"
- Value out of range: "JWT_SECRET must be at least 32 characters for security"

**Fail Fast Philosophy:** Configuration errors are caught immediately at startup rather than causing runtime failures during request handling.

## Usage Examples

### Basic Configuration Access

```typescript
import { env } from '@/server/src/config';

// Start server on configured port
const server = Bun.serve({
  port: env.PORT,
  hostname: env.HOST,
  fetch: handler,
});

console.log(`Server listening on ${env.HOST}:${env.PORT}`);
```

### Environment-Specific Behavior

```typescript
import { env, isProduction, isDevelopment } from '@/server/src/config';

// Enable features based on environment
const corsOrigins = isProduction()
  ? env.CORS_ORIGINS.split(',')
  : ['*']; // Allow all origins in development

// Conditional logging
if (isDevelopment()) {
  console.log('Database URL:', env.DATABASE_URL);
}
```

### Optional Feature Flags

```typescript
import { env } from '@/server/src/config';

// Conditionally enable analytics
if (env.ANALYTICS_ENABLED) {
  await recordAnalyticsEvent({
    event_type: 'http_request',
    data: { method, path, duration },
  });
}

// Gracefully handle missing API keys
if (env.GOOGLE_BOOKS_API_KEY) {
  const metadata = await googleBooksClient.lookup(isbn);
} else {
  console.warn('Google Books API key not configured, skipping provider');
}
```

## Integration Points

- **[Database Domain](./database.md)** - Uses `env.DATABASE_URL` for connection configuration
- **[Authentication Domain](./authentication.md)** - Uses `env.JWT_SECRET`, `env.JWT_EXPIRES_IN`, and `env.JWT_SECRET_OLD` for token signing
- **[Logging Domain](./logging.md)** - Uses `env.LOG_LEVEL` to set minimum log level
- **[Book Metadata Services Domain](./book-metadata-services.md)** - Uses `env.GOOGLE_BOOKS_API_KEY` and `env.OPEN_LIBRARY_API_KEY` for provider authentication
- **[Analytics Domain](./analytics.md)** - Uses `env.ANALYTICS_ENABLED` and `env.ANALYTICS_RETENTION_DAYS` for event collection

## Invariants

1. **Validation on Startup** - All environment variables are validated before the application starts
2. **Required Variables Must Exist** - `DATABASE_URL` and `JWT_SECRET` must be provided (except in test mode)
3. **Type Safety** - All configuration access is type-safe through the `Env` type
4. **Immutable at Runtime** - Configuration cannot change after validation (no runtime updates)
5. **Test Defaults** - Test environment always has valid defaults for required variables

## Use Cases

### Starting the Application

```typescript
// config.ts validates environment on module load
import { env } from '@/server/src/config';

// If validation fails, the import throws and the app never starts
const server = startServer(env);
```

### Feature Flags

```typescript
// Enable/disable features based on configuration
if (env.RATE_LIMIT_ENABLED) {
  app.use(rateLimitMiddleware);
}

if (env.SENTRY_ENABLED && env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN });
}
```

### External Service Integration

```typescript
// Compose metadata services based on available API keys
const providers: BookMetadataProvider[] = [];

if (env.GOOGLE_BOOKS_API_KEY) {
  providers.push(createGoogleBooksProvider(env.GOOGLE_BOOKS_API_KEY));
}

if (env.OPEN_LIBRARY_API_KEY) {
  providers.push(createOpenLibraryProvider(env.OPEN_LIBRARY_API_KEY));
}

const metadataService = createCompositeService(providers);
```

### Environment-Specific Security

```typescript
// Enforce HTTPS in production
if (isProduction() && env.HTTPS_REDIRECT) {
  app.use(httpsRedirectMiddleware);
}

// Strict CORS in production, permissive in development
const corsOrigins = isProduction()
  ? env.CORS_ORIGINS.split(',')
  : ['*'];
```

## Related Documentation

- [Environment Variables Reference](../docs/reference/environment-variables.md) - Complete list of all supported environment variables
- [Development Setup](../docs/how-to/setup-development.md) - How to configure a development environment
- [Deployment Guide](../docs/how-to/deploy.md) - Production configuration best practices
