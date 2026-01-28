# Environment Variables Reference

This document lists all environment variables used by Quailcomp.

## Database

### Required

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DB_HOST` | Database host | `localhost` | `localhost` |
| `DB_PORT` | Database port | `5432` | `5432` |
| `DB_NAME` | Database name | `quailcomp` | `quailcomp` |
| `DB_USER` | Database user | `quailcomp_app` | `quailcomp_app` |
| `DB_PASSWORD` | Database password | (none) | `your_password` |

### Optional

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DB_TEST_NAME` | Test database name | `quailcomp_test` | `quailcomp_test` |
| `DB_SUPERUSER` | Superuser for setup scripts | `$USER` | `postgres` |

### PostgreSQL Standard Variables

The database scripts also support standard PostgreSQL environment variables:

| Variable | Maps To | Example |
|----------|---------|---------|
| `PGHOST` | `DB_HOST` | `localhost` |
| `PGPORT` | `DB_PORT` | `5432` |
| `PGDATABASE` | `DB_NAME` | `quailcomp` |
| `PGUSER` | `DB_USER` | `quailcomp_app` |
| `PGPASSWORD` | `DB_PASSWORD` | `your_password` |

## Authentication

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | Yes (server) | `your_secret_key_here` |

## Server

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port | `3000` | `3000` |
| `HOSTNAME` | Server hostname | `0.0.0.0` | `localhost` |
| `LOG_LEVEL` | Logging level | `info` | `debug`, `info`, `warn`, `error` |

## Book Metadata Providers

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `GOOGLE_BOOKS_API_KEY` | Google Books API key | No | `AIza...` |
| `HARDCOVER_API_KEY` | Hardcover API key | No | `hc_...` |

**Note:** These are optional. The metadata service works without API keys but may be rate-limited.

## Environment File

Create a `.env` file in the project root:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quailcomp
DB_USER=quailcomp_app
DB_PASSWORD=your_password

# Authentication
JWT_SECRET=your_jwt_secret_key

# Server
PORT=3000
HOSTNAME=0.0.0.0
LOG_LEVEL=info

# Book Metadata (optional)
GOOGLE_BOOKS_API_KEY=your_google_books_key
HARDCOVER_API_KEY=your_hardcover_key
```

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
