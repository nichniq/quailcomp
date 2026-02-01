# Environment Variables Reference

This document lists all environment variables used by Quailcomp.

## Configuration Validation

Server configuration is validated using [Zod](https://zod.dev) schemas. Invalid configuration will cause the server to fail on startup with a clear error message. See [server/src/config.ts](../../server/src/config.ts:1) for the validation schema.

## Server (Required)

| Variable | Description | Default | Validation |
|----------|-------------|---------|------------|
| `DATABASE_URL` | PostgreSQL connection URL | (none) | Must be valid PostgreSQL URL |
| `JWT_SECRET` | Secret key for JWT tokens | (none) | Minimum 32 characters |
| `NODE_ENV` | Runtime environment | `development` | `development`, `production`, or `test` |

## Server (Optional)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port | `3000` | `3000` |
| `HOST` | Server hostname | `0.0.0.0` | `0.0.0.0` |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` | `7d`, `24h`, `30m` |
| `JWT_SECRET_OLD` | Previous JWT secret for rotation | (none) | 32+ character string |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:5173` | `http://localhost:5173,http://localhost:3000` |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `true` | `true`, `false` |
| `LOG_LEVEL` | Logging level | `info` | `error`, `warn`, `info`, `debug` |

## Analytics

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ANALYTICS_ENABLED` | Enable analytics tracking | `true` | `true`, `false` |
| `ANALYTICS_RETENTION_DAYS` | Days to retain analytics data | `90` | `90`, `30`, `180` |

## Observability

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SENTRY_DSN` | Sentry project DSN for error tracking | (none) | `https://...@sentry.io/...` |
| `SENTRY_ENABLED` | Enable Sentry error tracking | `false` | `true`, `false` |
| `PROMETHEUS_ENABLED` | Enable Prometheus metrics endpoint | `true` | `true`, `false` |


## Book Metadata Providers

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `GOOGLE_BOOKS_API_KEY` | Google Books API key | No | `AIza...` |
| `HARDCOVER_API_KEY` | Hardcover API key | No | `hc_...` |

**Note:** These are optional. The metadata service works without API keys but may be rate-limited.

## Environment File

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

The `.env.example` file contains all available configuration options with documentation. See [.env.example](../../.env.example:1) for the complete template.

## Database Setup Scripts

The database setup scripts (separate from the server) use different environment variables:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DB_HOST` | Database host | `localhost` | `localhost` |
| `DB_PORT` | Database port | `5432` | `5432` |
| `DB_NAME` | Database name | `quailcomp` | `quailcomp` |
| `DB_USER` | Database user | `quailcomp_app` | `quailcomp_app` |
| `DB_PASSWORD` | Database password | (none) | `your_password` |
| `DB_TEST_NAME` | Test database name | `quailcomp_test` | `quailcomp_test` |
| `DB_SUPERUSER` | Superuser for setup scripts | `$USER` | `postgres` |

These also support standard PostgreSQL environment variables (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`).

## Per-Directory .env Files

Some directories have their own `.env` files for specific operations:

### data/postgres/setup/.env

For database setup scripts:

```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_admin_password
PGDATABASE=postgres
```

### data/postgres/migrations/.env

For migration scripts (falls back to setup/.env):

```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGDATABASE=quailcomp
```

### data/postgres/teardown/.env

For teardown scripts:

```bash
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_admin_password
PGDATABASE=postgres  # Must NOT be quailcomp
```

## Security Notes

- **Never commit `.env` files** - They're gitignored by default
- **Use different passwords** for different environments
- **Rotate secrets** periodically
- **Use environment-specific values** in CI/CD

## Checking Configuration

### Verify Database Connection

```bash
# Using environment variables
psql -c "SELECT 1"

# Or explicitly
PGHOST=localhost PGUSER=quailcomp_app PGDATABASE=quailcomp psql -c "SELECT 1"
```

### Verify Server Configuration

```bash
# Start server and check logs
cd server
bun run dev
# Should show: "Server listening on http://0.0.0.0:3000"
```

## Related

- [Development Setup](../how-to/setup-development.md) - Initial configuration
- [Database Roles](../explanation/database-roles.md) - Why different users
- [Run Migrations](../how-to/run-migrations.md) - Migration environment
