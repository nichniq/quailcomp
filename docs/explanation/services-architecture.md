# Why Services?

This document explains the services architecture in Quailcomp and when to create new services.

## What Are Services?

Services are self-contained modules that handle integration with external systems. They provide well-defined interfaces for capabilities like fetching metadata, importing data, or communicating with third-party APIs.

## The Architecture Pattern

Quailcomp follows a **hexagonal architecture** (ports and adapters):

```
┌─────────────────────────────────────┐
│        External Systems             │
│  (APIs, Banks, Email, etc.)         │
└─────────────────────────────────────┘
                 ▲
                 │
┌─────────────────────────────────────┐
│           Services Layer            │
│   ┌─────────────────────────────┐   │
│   │   book-metadata service     │   │
│   │   (future) bank-statements  │   │
│   │   (future) email-ingestion  │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
                 ▲
                 │
┌─────────────────────────────────────┐
│         Backend Domains             │
│  (books, contacts, finances)        │
└─────────────────────────────────────┘
```

**Key principle:** Services adapt external systems to internal interfaces. Domains never know about external APIs directly.

## Why This Separation?

### Substitutability

Implementations can be swapped without changing domain code:

```typescript
// Today: Use Google Books
const lookup = createGoogleBooksProvider({ apiKey })

// Tomorrow: Switch to Open Library
const lookup = createOpenLibraryProvider()

// Domain code doesn't change
const metadata = await lookup.lookup(isbn)
```

### Testability

Services can be mocked for testing:

```typescript
const mockLookup = createMockProvider({
  responses: new Map([
    ['9780134685991', { title: 'Test Book', authors: ['Author'] }]
  ])
})

// Test domain logic without hitting real APIs
```

### Domain Agnosticism

Services know nothing about domain models. They return generic data that domains interpret:

```typescript
// Service returns generic metadata
interface BookMetadata {
  isbn: string;
  title: string;
  authors: string[];
}

// Domain interprets it for its model
const book = await entities.create({
  type: 'book',
  data: {
    title: metadata.title,
    authors: metadata.authors,
    isbn13: metadata.isbn
  }
})
```

## Service Design Principles

### Factory Functions

Services use factory functions that return objects:

```typescript
function createBookMetadataService(config: Config): BookMetadataService {
  const apiKey = config.apiKey;

  return {
    async lookup(isbn: string): Promise<BookMetadata | null> {
      // Implementation uses config via closure
    }
  };
}
```

No classes, no `this`, no inheritance.

### Composition

Services can be composed:

```typescript
const composite = createCompositeProvider({
  providers: [
    createGoogleBooksProvider({ apiKey }),
    createOpenLibraryProvider(),
    createLibraryOfCongressProvider()
  ]
})

// Tries each provider until one succeeds
const result = await composite.lookup(isbn)
```

### Explicit Dependencies

Dependencies are passed explicitly, not imported:

```typescript
// Good: dependency injected
function createEmailService(config: { transport: EmailTransport }) {
  return {
    async send(to, subject, body) {
      await config.transport.sendMail({ to, subject, body })
    }
  }
}

// Bad: dependency hidden
function createEmailService() {
  const transport = nodemailer.createTransport(...)  // Hidden!
}
```

## Current Services

### book-metadata

Fetches book metadata from multiple providers.

**Location:** `services/book-metadata/`

**Providers:**

- Google Books
- Open Library
- Library of Congress
- Hardcover
- WorldCat

**Usage:**

```typescript
import { createBookMetadataService } from '@quailcomp/book-metadata'

const service = createBookMetadataService({
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY
})

const book = await service.lookup('978-0134685991')
```

## WebSocket Real-time Updates

The WebSocket system provides real-time entity update notifications to connected clients.

**Location:** `server/src/websocket/`

### Architecture

```
Client                    Server                    Database
  |                         |                           |
  |-- WS Connect /ws ------>|                           |
  |    (with JWT token)     |                           |
  |                         |-- Authenticate ---------->|
  |<-- Connection OK -------|                           |
  |                         |                           |
  |-- Subscribe entity ---->|                           |
  |                         |-- Check access ---------->|
  |<-- Subscribed ----------|                           |
  |                         |                           |
  |                         |<-- Entity updated --------|
  |                         |   (via route handler)     |
  |<-- Broadcast update ----|                           |
```

### Components

**WebSocket Server** (`server/src/websocket/server.ts`)

- Handles WS connections at `/ws` endpoint
- Authenticates via JWT token (query parameter)
- Manages client subscriptions
- Broadcasts entity events

**Subscription Management**

- Clients subscribe to specific entity IDs
- Authorization checked on subscription (requires read access)
- Clients only receive updates for accessible entities
- Automatic cleanup on disconnect

**Event Broadcasting**

- Route handlers call `broadcastUpdate()` after mutations
- Events: `entity.created`, `entity.updated`, `entity.deleted`
- Only sent to authorized subscribers
- Includes entity type and full data

### Usage

**Server-side broadcasting:**

```typescript
import { broadcastUpdate } from '@/websocket/server'

// After creating an entity
const entry = await entities.create({ type: 'book', data: bookData })
await authzService.grantOwnerOnCreate(entry.entityId, userId)

// Broadcast to subscribers
broadcastUpdate(entry.entityId, {
  type: 'entity.created',
  entityId: entry.entityId,
  entityType: 'book',
  data: entry.data
})
```

**Client-side subscription:**

```javascript
const ws = new WebSocket(`ws://localhost:3000/ws?token=${authToken}`)

ws.onopen = () => {
  // Subscribe to entity updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    entityId: '123'
  }))
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)

  if (message.type === 'entity.updated') {
    // Update UI with new data
    console.log('Entity updated:', message.entityId, message.data)
  }
}
```

### Security

- JWT authentication required for WebSocket connection
- Token validated on initial connection
- Authorization enforced per subscription (read access required)
- Invalid subscriptions silently ignored
- Expired tokens cause connection termination

### Design Decisions

**Why JWT via query parameter?**

- WebSocket API doesn't support custom headers in browsers
- Query parameter is standard approach for WS authentication
- Token is only transmitted once during connection upgrade

**Why not send all updates?**

- Authorization must be respected (user privacy)
- Reduces bandwidth (only relevant updates)
- Client explicitly opts in via subscription

**Why no collaborative editing?**

- Operational Transform or CRDT adds significant complexity
- Last-write-wins is sufficient for most use cases
- Can be added later if needed

## Phase 5 Domain Relationships

Phase 5 introduced new domains that reference the Books domain.

### People Domain

Tracks authors, gift-givers, borrowers, and other contacts.

**Location:** `domains/people.md`

**References to People from Books:**

- `acquisition.person_id` - Who gave the book (when type is "given")
- `lending.person_id` - Who borrowed the book (future)

**Query Pattern:**

```typescript
// Get all books given by a person
const books = await sql`
  SELECT * FROM entities
  WHERE type = 'book'
    AND deleted_at IS NULL
    AND data->'acquisition'->>'person_id' = ${personId}
`
```

### Series Domain

Groups related books (trilogies, multi-volume works, etc.).

**Location:** `domains/series.md`

**References to Series from Books:**

- `series_id` - Which series this book belongs to
- `volume_number` - Position in the series (optional)

**Query Pattern:**

```typescript
// Get all books in a series, ordered by volume
const books = await sql`
  SELECT * FROM entities
  WHERE type = 'book'
    AND deleted_at IS NULL
    AND (data->>'series_id')::int = ${seriesId}
  ORDER BY (data->>'volume_number')::int NULLS LAST
`
```

### Domain Interactions

```
Person
  └─> Books (as gift-giver)
  └─> Books (as borrower)

Series
  └─> Books (as series member)

Book
  ├─> Person (gift-giver via acquisition.person_id)
  ├─> Person (borrower via lending.person_id)
  └─> Series (belongs to via series_id)
```

**Key Design Principle:** Domains reference each other by ID only (loose coupling). The Books domain doesn't import Person or Series types - it just stores their entity IDs as numbers.

## When to Create a Service

Create a service when you need to:

### Integrate with External APIs

- Book metadata (Google Books, Open Library)
- Financial data (Plaid, bank APIs)
- Location services (Google Maps, OpenStreetMap)

### Import Data from External Sources

- Bank statements
- Email parsing
- Contact sync

### Send Data to External Systems

- Email notifications
- Webhooks
- Third-party integrations

## When NOT to Create a Service

Don't create a service for:

### Domain Logic

Business rules belong in domains, not services:

```typescript
// Bad: domain logic in service
function calculateLateFeesService() { ... }

// Good: domain logic in domain
// books domain handles its own business rules
```

### Database Access

Use the data layer (`@quailcomp/data`):

```typescript
// Bad: service for database
function createBookDatabaseService() { ... }

// Good: use existing data layer
import { EntitiesClient } from '@quailcomp/data'
```

### Simple Utilities

Pure functions belong in a utils module:

```typescript
// Bad: service for utility
function createDateFormatterService() { ... }

// Good: utility function
export function formatDate(date: Date): string { ... }
```

## Service Structure

A typical service:

```
services/your-service/
├── types.ts           # Interface and error types
├── provider-one.ts    # Implementation #1
├── provider-two.ts    # Implementation #2
├── composite.ts       # Composite implementation
├── mock.ts            # Mock for testing
├── index.ts           # Exports
├── package.json
└── README.md
```

### types.ts

Define the interface and error types:

```typescript
export interface MyService {
  doSomething(input: string): Promise<Result>;
}

export class ServiceUnavailableError extends Error {
  constructor(provider: string, cause?: Error) {
    super(`Service unavailable: ${provider}`);
    this.name = 'ServiceUnavailableError';
    this.cause = cause;
  }
}
```

### Implementation Files

Each implementation is a factory function:

```typescript
export function createProviderOne(config: Config): MyService {
  return {
    async doSomething(input: string): Promise<Result> {
      // Implementation
    }
  };
}
```

### index.ts

Export everything:

```typescript
export * from './types';
export { createProviderOne } from './provider-one';
export { createProviderTwo } from './provider-two';
export { createComposite } from './composite';
export { createMock } from './mock';
```

## Error Handling

Services should:

- Define custom error types
- Include context in error messages
- Not swallow errors silently

```typescript
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ServiceUnavailableError(
      'google-books',
      new Error(`HTTP ${response.status}`)
    );
  }
} catch (error) {
  if (error instanceof ServiceUnavailableError) throw error;
  throw new ServiceUnavailableError('google-books', error as Error);
}
```

## Testing Services

Services should be independently testable:

```typescript
describe('GoogleBooksProvider', () => {
  test('returns null for non-existent ISBN', async () => {
    const lookup = createGoogleBooksProvider();
    const result = await lookup.lookup('9999999999999');
    expect(result).toBeNull();
  });

  test('returns metadata for valid ISBN', async () => {
    const lookup = createGoogleBooksProvider();
    const result = await lookup.lookup('9780134685991');
    expect(result?.title).toBeTruthy();
  });
});
```

Use mock implementations for testing domain code:

```typescript
const mockService = createMockProvider({
  responses: new Map([...])
});

// Test domain without hitting real APIs
```

## Related

- [book-metadata README](/services/book-metadata/README.md) - Current service documentation
- [Event Sourcing](event-sourcing.md) - How services feed into the data model
- [Environment Variables](../reference/environment-variables.md) - API key configuration
