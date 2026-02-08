# Quailcomp

[![codecov](https://codecov.io/gh/USERNAME/quailcomp/branch/main/graph/badge.svg?token=YOUR_TOKEN)](https://codecov.io/gh/USERNAME/quailcomp)

A personal data management system using event-sourced append-only storage with domain-driven design.

## Overview

Quailcomp is a sophisticated TypeScript application that demonstrates production-quality patterns for event sourcing, domain-driven design, and personal data management. Built as a Bun monorepo with PostgreSQL 16, it provides a flexible foundation for tracking books, contacts, locations, and other personal data with complete audit history.

### What Makes Quailcomp Unique

- **Event-Sourced Storage** - Append-only architecture preserves complete history and enables time-travel queries
- **Markdown-Driven Domains** - Domain documentation lives in Markdown with auto-extracted TypeScript types (documentation never drifts from code)
- **Multi-Provider Book Metadata** - Intelligent fallback across 5 book lookup services (Google Books, Open Library, Library of Congress, Hardcover, WorldCat)
- **Enrichable Events** - Immutable events can be annotated and corrected while preserving original data
- **Clean Auth/Authz Separation** - Authentication method is an implementation detail; authorization operates on stable user IDs
- **Pragmatic DDD** - Real-world acknowledgment that data is messy with optional fields and minimal enforcement

### Who Is This For?

- Developers learning event sourcing and domain-driven design
- Teams building personal data management systems
- Anyone interested in append-only data architecture
- Researchers exploring literate programming with executable documentation

## Features

- **Book Collection Management** - Track physical books with metadata, acquisition history, and ISBN/LCCN lookup
- **Event Sourcing** - Complete audit trail of all changes with historical reconstruction
- **Multi-Method Authentication** - Password, passkey/WebAuthn, OAuth, and API key support
- **Resource-Level Authorization** - Per-entity permissions with owner/write/read hierarchy
- **Domain Documentation** - Markdown files with embedded TypeScript types auto-extracted for import
- **Book Metadata Lookup** - Query 5 providers in parallel with automatic fallback
- **Vue 3 Frontend** - Modern SPA with Pinia state management
- **RESTful API** - Bun HTTP server with middleware composition
- **People Management** - Track authors, gift-givers, and borrowers with full CRUD API and relationship tracking
- **Series Tracking** - Organize books into series with volume ordering and comprehensive series management
- **Bulk Operations** - Import/export books in CSV, JSON, or XLSX formats with batch update support
- **Real-time Updates** - WebSocket support for live entity updates with authorization-aware event broadcasting
- **Batch Processing** - Update multiple books in a single API call with per-entity authorization checks

## Quick Start

See [Development Setup](docs/how-to/setup-development.md) for complete instructions.

### Prerequisites

- [Bun](https://bun.sh) 1.3.6 or higher
- PostgreSQL 16
- Git

### Installation

```bash
git clone https://github.com/yourusername/quailcomp.git
cd quailcomp
bun install
```

### Database Setup

```bash
cd data/postgres/setup && ./run.sh  # Create database and roles
bun run db:migrate                   # Run migrations
```

### Running

```bash
cd server && bun run dev     # Backend at http://localhost:3000
cd frontend && bun run dev   # Frontend at http://localhost:5173
```

See [Environment Variables](docs/reference/environment-variables.md) for configuration.

## Architecture

### High-Level Overview

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │─────▶│    Server    │─────▶│  Data Layer  │─────▶│ PostgreSQL   │
│   (Vue 3)    │      │  (Bun HTTP)  │      │   Clients    │      │      16      │
└──────────────┘      └──────┬───────┘      └──────────────┘      └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Book Metadata│
                      │   Service    │
                      └──────┬───────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Google Books │   │ Open Library │   │  Library of  │  ...
│              │   │              │   │   Congress   │
└──────────────┘   └──────────────┘   └──────────────┘
```

### Core Concepts

#### Event Sourcing

Quailcomp uses two fundamental table types:

**Entities** (Mutable State - "Nouns"):

- Represent things that exist and change over time
- Multiple entries share the same `entity_id` (each is a version)
- Latest entry = current state
- Operations: create, update, delete (soft), getById, getHistory

**Events** (Immutable Facts - "Verbs"):

- Record things that happened
- Multiple entries share the same `event_id` (original + enrichments)
- Cannot be changed, only enriched or voided
- Operations: record, enrich, void (soft), getByTimeRange

Both tables are append-only with JSONB data storage for flexibility.

#### Domain-Driven Design

Each domain is a bounded context documented in `/domains/*.md`:

- **Authentication** - User identity with multiple authentication methods
- **Authorization** - Resource-level permissions (owner/write/read)
- **Books** - Physical book collection and acquisition history
- **People** - Authors, gift-givers, borrowers, and other contacts
- **Series** - Book series and collections with volume ordering

Domains reference each other by ID only (loose coupling).

#### Markdown-Driven Types

Domain documentation is written in Markdown with TypeScript code blocks. Types are automatically extracted to `/domains/types/*.ts`:

```typescript
// Import types from auto-generated files
import type { PhysicalBook } from '@/domains/types/books'
import type { User, Credential } from '@/domains/types/authentication'
```

This ensures documentation and code never drift apart.

## Project Structure

```
quailcomp/
├── data/
│   ├── client/               # @quailcomp/data package
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── entities.ts    # EntitiesClient (mutable state)
│   │   │   │   ├── events.ts      # EventsClient (immutable facts)
│   │   │   │   ├── connection.ts  # Database connection
│   │   │   │   └── types.ts       # Core types
│   │   │   └── index.ts
│   │   └── tests/
│   └── postgres/             # Database schema
│       ├── migrations/       # SQL migrations (auto-applied)
│       ├── setup/            # Database initialization
│       └── teardown/         # Database cleanup
│
├── server/                   # Backend HTTP server
│   ├── src/
│   │   ├── server.ts         # Server initialization
│   │   ├── router.ts         # Path-based routing
│   │   ├── context.ts        # Request context
│   │   ├── routes/           # Route handlers
│   │   ├── auth/             # Authentication service
│   │   ├── middleware/       # Middleware stack
│   │   ├── logging/          # Request logging
│   │   └── metrics/          # Observability metrics
│   └── tests/
│
├── frontend/                 # Vue 3 + Pinia frontend
│   ├── src/
│   │   ├── App.vue
│   │   ├── views/
│   │   ├── components/
│   │   ├── router/
│   │   ├── stores/           # Pinia state management
│   │   └── api/              # API client
│   └── vite.config.ts
│
├── services/
│   └── book-metadata/        # @quailcomp/book-metadata
│       └── src/
│           ├── providers/    # Google Books, Open Library, etc.
│           └── index.ts
│
├── domains/                  # Domain documentation
│   ├── authentication.md     # Auth domain with types
│   ├── authorization.md      # Authz domain with types
│   ├── books.md              # Books domain with types
│   ├── people.md             # People domain with types
│   ├── series.md             # Series domain with types
│   ├── types/                # Auto-generated TypeScript
│   │   ├── authentication.ts
│   │   ├── authorization.ts
│   │   ├── books.ts
│   │   ├── people.ts
│   │   └── series.ts
│   ├── scripts/
│   │   └── extract-types.ts  # Type extraction script
│   └── README.md             # Domain philosophy
│
├── .claude/
│   └── CLAUDE.md             # AI assistant instructions
├── .githooks/                # Git hook templates
├── CONTRIBUTING.md           # Development guidelines
├── package.json              # Workspace configuration
└── README.md                 # This file
```

## Development

### Common Commands

```bash
# Testing
bun test                      # Run all tests with linting
bun run test:coverage         # Run tests with coverage report
bun test:unit                 # Run tests without linting
bun test:watch                # Watch mode for data/client

# Database
bun run db:migrate            # Apply pending migrations
bun run db:setup              # Create test database (rare)
bun run db:teardown           # Drop test database (rare)

# Linting
bun run lint                  # Lint TypeScript and Markdown
bun run lint:fix              # Auto-fix lint issues

# Git Hooks
bash scripts/install-hooks.sh # Install git hooks from .githooks/

# Domain Types
bun run domains/scripts/extract-types.ts  # Extract types from Markdown
```

### Development Workflow

1. **Make changes** - Edit code following project patterns
2. **Run tests** - `bun test` to verify changes
3. **Lint** - `bun run lint` to check code style
4. **Commit** - Follow commit protocol (see below)

### Data Access Patterns

#### EntitiesClient (Mutable State)

```typescript
import { getConnection, EntitiesClient } from '@quailcomp/data'

const sql = getConnection()
const entities = new EntitiesClient(sql)

// Create
const book = await entities.create({
  type: 'book',
  data: {
    title: 'Domain-Driven Design',
    author: 'Eric Evans',
    isbn: '9780321125215'
  }
})

// Update
await entities.update({
  entityId: book.entity_id,
  type: 'book',
  data: { notes: 'Classic DDD reference' }
})

// Get current state
const current = await entities.getById(book.entity_id)

// Get full history
const history = await entities.getHistory(book.entity_id)

// Soft delete
await entities.delete({
  entityId: book.entity_id,
  type: 'book',
  data: { reason: 'Sold to friend' }
})
```

#### EventsClient (Immutable Facts)

```typescript
import { getConnection, EventsClient } from '@quailcomp/data'

const sql = getConnection()
const events = new EventsClient(sql)

// Record event
const acquisition = await events.record({
  eventType: 'book_acquired',
  occurredAt: new Date('2024-01-15'),
  data: {
    entity_id: bookId,
    method: 'purchased',
    location: 'Powell\'s Books',
    cost: { amount: 2999, currency: 'USD' }
  }
})

// Enrich event (add information later)
await events.enrich({
  eventId: acquisition.event_id,
  eventType: 'book_acquired',
  occurredAt: acquisition.occurred_at,
  data: { receipt_number: 'RCP-123456' }
})

// Query by time range
const recentEvents = await events.getByTimeRange(
  new Date('2024-01-01'),
  new Date('2024-12-31')
)
```

### Domain Documentation

Before implementing features, check domain documentation in `/domains/`:

```bash
# Read domain files to understand concepts
cat domains/authentication.md
cat domains/books.md

# After updating domain docs, extract types
bun run domains/scripts/extract-types.ts
```

The pre-commit hook automatically extracts types when `.md` files change.

## API Reference

### Authentication

**POST `/auth/register`** - Create new user

Request:

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "username": "johndoe"
}
```

Response:

```json
{
  "user": {
    "userId": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-15T11:30:00Z"
}
```

**POST `/auth/login`** - Authenticate user

Request:

```json
{
  "identifier": "user@example.com",
  "password": "securepassword"
}
```

Response:

```json
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-15T11:30:00Z"
}
```

**GET `/auth/me`** - Get current user

Headers:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```json
{
  "user": {
    "userId": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Books

**GET `/books`** - List all books

Requires authentication.

Response:

```json
{
  "books": [
    {
      "entity_id": 1,
      "type": "book",
      "data": {
        "title": "Domain-Driven Design",
        "author": "Eric Evans",
        "isbn": "9780321125215"
      },
      "entered_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**GET `/books/:id`** - Get single book

**POST `/books`** - Create book

Request:

```json
{
  "title": "Domain-Driven Design",
  "author": "Eric Evans",
  "isbn": "9780321125215",
  "publisher": "Addison-Wesley",
  "publishedDate": "2003-08-20"
}
```

**PUT `/books/:id`** - Update book

**DELETE `/books/:id`** - Soft delete book

**POST `/books/metadata/lookup`** - Multi-provider metadata lookup

Request:

```json
{
  "identifier": "9780321125215",
  "identifierType": "isbn"
}
```

Response:

```json
{
  "results": [
    {
      "provider": "google-books",
      "data": {
        "title": "Domain-Driven Design",
        "authors": ["Eric Evans"],
        "isbn13": "9780321125215",
        "publisher": "Addison-Wesley"
      },
      "responseTime": 245
    },
    {
      "provider": "open-library",
      "data": { ... },
      "responseTime": 312
    }
  ]
}
```

### Monitoring

**GET `/health`** - Health check

Response:

```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**GET `/metrics`** - Observability metrics

Response:

```json
{
  "counters": {
    "http_requests_total": 1523
  },
  "histograms": {
    "http_request_duration_ms": {
      "count": 1523,
      "sum": 45670,
      "avg": 29.98
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Testing

### Test Database

Tests automatically create and manage a separate `quailcomp_test` database:

- Created on first test run
- Migrations auto-applied
- Cleaned up automatically

### Running Tests

```bash
# All tests with linting
bun test

# Unit tests only (skip linting)
bun test:unit

# Watch mode (data/client only)
bun test:watch
```

### Writing Tests

Use unique type names with timestamps to avoid conflicts:

```typescript
import { test, expect } from 'bun:test'

test('create book entity', async () => {
  const type = `book_${Date.now()}`

  const book = await entities.create({
    type,
    data: { title: 'Test Book' }
  })

  expect(book.entity_id).toBeGreaterThan(0)
  expect(book.data.title).toBe('Test Book')
})
```

## Documentation

Documentation follows the [Diátaxis](https://diataxis.fr/) framework:

- **[Tutorials](docs/tutorials/)** - Learning-oriented walkthroughs
- **[How-To Guides](docs/how-to/)** - Task-oriented guides for common operations
- **[Explanation](docs/explanation/)** - Understanding the architecture
- **[Reference](docs/reference/)** - API and configuration details

Key starting points:

- [Tutorial: Add a New Domain](docs/tutorials/add-a-new-domain.md)
- [Development Setup](docs/how-to/setup-development.md)
- [Why Event Sourcing?](docs/explanation/event-sourcing.md)
- [Domain Models](docs/reference/domains.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

This project is released into the public domain under the [Unlicense](https://unlicense.org/). See [LICENSE](LICENSE) for details.

You are free to copy, modify, publish, use, compile, sell, or distribute this software for any purpose, commercial or non-commercial, and by any means.

---

**Quailcomp** - A state-of-the-art computer powered by quails
