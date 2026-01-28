# Data Directory

This directory contains all data-related code for the Quailcomp project.

## Structure

```
data/
├── client/           # @quailcomp/data - TypeScript client library
└── postgres/         # Raw PostgreSQL infrastructure
```

## Philosophy

The `data/` directory is organized around a clear separation of concerns:

- **`client/`** - The TypeScript client library (`@quailcomp/data`) that application code imports. This is where all data access logic lives—database clients, filesystem integrations, third-party API clients (like Plaid), etc.

- **`postgres/`** - Raw PostgreSQL infrastructure: SQL migrations, setup scripts, teardown scripts, and operational tools. This is database administration, not application code.

## Why This Structure?

### Colocation with Clear Boundaries

The client code and database schema are tightly coupled—when you change the schema, you often need to update the client. By colocating them in `data/`, you keep related concerns together. But by separating `client/` (TypeScript) from `postgres/` (SQL/shell scripts), you maintain a clear boundary between application code and infrastructure.

### Single Package for Multiple Data Sources

The `@quailcomp/data` package can provide access to multiple data sources:

- `db` - PostgreSQL database
- `fs` - Filesystem operations (future)
- `plaid` - Plaid API integration (future)
- etc.

This allows server code to import everything from one place:

```typescript
import { EntitiesClient, PlaidClient, FileStore } from "@quailcomp/data"
```

### Scalability

If you later need multiple databases (e.g., adding Redis), just add `data/redis/` alongside `data/postgres/`. The `client/` package would export both `db` and `cache` modules.

## Usage

From `server/` or other workspaces:

```typescript
import { EntitiesClient, createConnection } from "@quailcomp/data"
```

See [`client/README.md`](./client/README.md) for more details on the client library.
