# Services

Services are self-contained modules that handle integration with external systems and data sources. They provide well-defined interfaces for capabilities like fetching metadata, importing data, or communicating with third-party APIs.

## Purpose

Services act as **adapters to the outside world**. They encapsulate the complexity of working with external systems while providing clean, domain-agnostic interfaces that our backend domains can use.

### Key Principles

1. **Single Responsibility**: Each service does one thing well (e.g., ISBN lookup, bank statement import)
2. **Clear Interface**: Well-defined TypeScript interfaces that describe what the service provides
3. **Domain Agnostic**: Services know nothing about our domain models or database schema
4. **Substitutable**: Implementations can be swapped (e.g., Google Books → OpenLibrary)
5. **Independently Testable**: Can be developed and tested without the rest of the system
6. **Functional Style**: No classes, no `this`, no inheritance - just functions and values

## Architecture Pattern

Services follow the **Hexagonal Architecture** (ports and adapters) pattern:

- **Domains** (in `/backend/domains`) contain our core business logic and data models
- **Services** (here in `/services`) are adapters that handle external integrations
- Domains depend on service interfaces, never on implementations
- Services never import from domains

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
│   │   isbn-lookup service       │   │
│   │   bank-statements service   │   │
│   │   email-ingestion service   │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
                 ▲
                 │
┌─────────────────────────────────────┐
│         Backend Domains             │
│  (books, contacts, finances)        │
└─────────────────────────────────────┘
```

## Structure

Each service is an npm package with:
```
/services
  /isbn-lookup
    - types.ts          # Interface definitions and types
    - google-books.ts   # Implementation using Google Books API
    - open-library.ts   # Alternative implementation
    - index.ts          # Exports and convenience functions
    - package.json
    - tsconfig.json
    - README.md         # Service-specific documentation
```

## Creating a New Service

### 1. Define Types and Interface

Start with what capability you're providing, not how you'll implement it:

```typescript
// /services/isbn-lookup/types.ts

export interface BookMetadata {
  isbn: string;
  title: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
}

export interface ISBNLookupService {
  /**
   * Look up book metadata by ISBN.
   * @returns BookMetadata if found, null if not found
   * @throws ISBNServiceUnavailableError if the service is unavailable
   */
  lookup(isbn: string): Promise<BookMetadata | null>;
}

// Error types
export class ISBNNotFoundError extends Error {
  constructor(isbn: string) {
    super(`No metadata found for ISBN: ${isbn}`);
    this.name = 'ISBNNotFoundError';
  }
}

export class ISBNServiceUnavailableError extends Error {
  constructor(provider: string, cause?: Error) {
    super(`ISBN lookup service unavailable: ${provider}`);
    this.name = 'ISBNServiceUnavailableError';
    this.cause = cause;
  }
}
```

### 2. Create an Implementation

Implementations are factory functions that return objects conforming to the interface:

```typescript
// /services/isbn-lookup/google-books.ts

import type { ISBNLookupService, BookMetadata } from './types';
import { ISBNServiceUnavailableError } from './types';

interface GoogleBooksConfig {
  apiKey?: string;
  timeout?: number;
}

export function createGoogleBooksLookup(
  config: GoogleBooksConfig = {}
): ISBNLookupService {
  const baseUrl = 'https://www.googleapis.com/books/v1/volumes';
  const timeout = config.timeout ?? 30000;

  return {
    async lookup(isbn: string): Promise<BookMetadata | null> {
      try {
        const url = new URL(baseUrl);
        url.searchParams.set('q', `isbn:${isbn}`);
        if (config.apiKey) {
          url.searchParams.set('key', config.apiKey);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url.toString(), {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new ISBNServiceUnavailableError(
            'google-books',
            new Error(`HTTP ${response.status}`)
          );
        }

        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
          return null;
        }

        const volumeInfo = data.items[0].volumeInfo;
        return {
          isbn,
          title: volumeInfo.title,
          authors: volumeInfo.authors || [],
          publisher: volumeInfo.publisher,
          publishedDate: volumeInfo.publishedDate,
          pageCount: volumeInfo.pageCount,
        };
      } catch (error) {
        if (error instanceof ISBNServiceUnavailableError) {
          throw error;
        }
        throw new ISBNServiceUnavailableError('google-books', error as Error);
      }
    },
  };
}
```

### 3. Export from index.ts

```typescript
// /services/isbn-lookup/index.ts

export * from './types';
export { createGoogleBooksLookup } from './google-books';
export { createOpenLibraryLookup } from './open-library';

// Optional: provide a smart default
import { createGoogleBooksLookup } from './google-books';

export function createISBNLookup(config?: { apiKey?: string }) {
  return createGoogleBooksLookup(config);
}
```

### 4. Add package.json

```json
{
  "name": "@quailcomp/isbn-lookup",
  "version": "0.1.0",
  "type": "module",
  "main": "./index.ts",
  "exports": {
    ".": "./index.ts"
  },
  "dependencies": {
    // External dependencies only
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

## Using Services in Backend Domains

Domains import and use services through their interfaces:

```typescript
// /backend/domains/books/handlers.ts

import { createISBNLookup, type BookMetadata } from '@quailcomp/isbn-lookup';

export function createBookEnrichmentService(config: {
  googleBooksApiKey?: string
}) {
  const isbnLookup = createISBNLookup({
    apiKey: config.googleBooksApiKey,
  });

  return {
    async enrichBookFromISBN(isbn: string): Promise<BookMetadata | null> {
      return await isbnLookup.lookup(isbn);
    },
  };
}
```

## Functional Patterns

### Factory Functions

Services use factory functions that return objects conforming to interfaces:

```typescript
function createMyService(config: Config): MyServiceInterface {
  // Config and dependencies captured in closure
  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl ?? 'https://api.example.com';

  // Return object implementing the interface
  return {
    async doSomething(param: string): Promise<Result> {
      // Implementation has access to config via closure
      const response = await fetch(`${baseUrl}/endpoint`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return processResponse(response);
    },
  };
}
```

### Composition

Services can be composed to create more sophisticated behaviors:

```typescript
// /services/isbn-lookup/composite.ts

import type { ISBNLookupService, BookMetadata } from './types';

interface CompositeConfig {
  services: ISBNLookupService[];
}

export function createCompositeLookup(
  config: CompositeConfig
): ISBNLookupService {
  return {
    async lookup(isbn: string): Promise<BookMetadata | null> {
      // Try each service in order until one succeeds
      for (const service of config.services) {
        try {
          const result = await service.lookup(isbn);
          if (result) {
            return result;
          }
        } catch (error) {
          // Try next service on error
          console.warn(`Service failed, trying next:`, error);
        }
      }
      return null;
    },
  };
}

// Usage:
// const lookup = createCompositeLookup({
//   services: [
//     createGoogleBooksLookup({ apiKey: 'key1' }),
//     createOpenLibraryLookup(),
//   ],
// });
```

### Dependency Injection

Pass dependencies explicitly rather than importing them:

```typescript
interface EmailServiceConfig {
  transport: EmailTransport;  // Injected dependency
  from: string;
}

export function createEmailService(
  config: EmailServiceConfig
): EmailService {
  const { transport, from } = config;

  return {
    async send(to: string, subject: string, body: string): Promise<void> {
      await transport.sendMail({
        from,
        to,
        subject,
        text: body,
      });
    },
  };
}

// Usage:
// const emailService = createEmailService({
//   transport: createSMTPTransport({ host: 'smtp.example.com' }),
//   from: 'noreply@example.com',
// });
```

## Configuration

Services accept configuration through factory function parameters:

```typescript
interface BankStatementConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export function createBankStatementService(
  config: BankStatementConfig
): BankStatementService {
  const baseUrl = config.baseUrl ?? 'https://api.bank.com';
  const timeout = config.timeout ?? 30000;

  return {
    async fetchStatements(accountId: string): Promise<Statement[]> {
      // Implementation uses config from closure
    },
  };
}
```

Environment variables should be read at the application boundary and passed in:

```typescript
// In your app initialization
const bankService = createBankStatementService({
  apiKey: process.env.BANK_API_KEY!,
  timeout: Number(process.env.BANK_TIMEOUT ?? '30000'),
});
```

## Error Handling

Services should:

- Define custom error types in `types.ts`
- Include context in error messages
- Not swallow errors silently
- Use standard Error classes (no inheritance needed)

```typescript
// types.ts
export class ServiceUnavailableError extends Error {
  constructor(serviceName: string, cause?: Error) {
    super(`Service unavailable: ${serviceName}`);
    this.name = 'ServiceUnavailableError';
    this.cause = cause;
  }
}

export class InvalidInputError extends Error {
  constructor(field: string, value: string) {
    super(`Invalid ${field}: ${value}`);
    this.name = 'InvalidInputError';
  }
}

// Implementation
if (!isValidISBN(isbn)) {
  throw new InvalidInputError('ISBN', isbn);
}
```

## Testing

Services should be independently testable:

```typescript
// /services/isbn-lookup/google-books.test.ts

import { describe, test, expect } from 'bun:test';
import { createGoogleBooksLookup } from './google-books';

describe('GoogleBooksLookup', () => {
  test('returns null for non-existent ISBN', async () => {
    const lookup = createGoogleBooksLookup();
    const result = await lookup.lookup('9999999999999');
    expect(result).toBeNull();
  });
  
  test('returns metadata for valid ISBN', async () => {
    const lookup = createGoogleBooksLookup();
    const result = await lookup.lookup('9780134685991');
    expect(result).not.toBeNull();
    expect(result?.title).toBeTruthy();
  });

  test('respects custom timeout', async () => {
    const lookup = createGoogleBooksLookup({ timeout: 1 });
    await expect(lookup.lookup('9780134685991')).rejects.toThrow();
  });
});
```

### Testing with Mock Implementations

Create mock implementations for testing:

```typescript
// /services/isbn-lookup/mock.ts

import type { ISBNLookupService, BookMetadata } from './types';

export function createMockLookup(
  responses: Map<string, BookMetadata | null>
): ISBNLookupService {
  return {
    async lookup(isbn: string): Promise<BookMetadata | null> {
      return responses.get(isbn) ?? null;
    },
  };
}

// In tests:
const mockLookup = createMockLookup(new Map([
  ['123', { isbn: '123', title: 'Test Book', authors: ['Author'] }],
]));
```

## Common Service Types

Based on your needs, services typically fall into these categories:

### Metadata Providers

Enrich your data with information from external sources:

- `isbn-lookup` - Book metadata
- `movie-db` - Film information
- `geocoding` - Location data

### Data Importers

Pull data from external systems into your database:

- `bank-statements` - Financial transactions
- `email-ingestion` - Parse structured data from emails
- `contacts-sync` - Import from Google/Apple contacts

### Notification Senders

Push data out to users or other systems:

- `email-sender` - Send emails via SMTP/API
- `sms-sender` - Send text messages
- `webhook-dispatcher` - Trigger external webhooks

## Migration Path

Services are designed to remain simple modules today while allowing for future extraction:

**Today**: Import as TypeScript modules

```typescript
import { createISBNLookup } from '@quailcomp/isbn-lookup';
const lookup = createISBNLookup({ apiKey: 'key' });
```

**Future** (if needed): Deploy as separate service

```typescript
import { createISBNLookupClient } from '@quailcomp/isbn-lookup-client';
const lookup = createISBNLookupClient({ baseUrl: 'https://isbn-service.com' });
// Same interface, different transport (HTTP/gRPC/etc.)
```

The interface remains stable; only the implementation changes.

## When NOT to Create a Service

Don't create a service for:

- **Domain logic** - That belongs in `/backend/domains`
- **Database access** - Use your existing entity/repository patterns
- **Simple utilities** - Use `/backend/utils` for pure functions
- **Frontend-specific code** - Keep in `/frontend`

Services are specifically for **integrating with external systems**.

## Questions?

When building a new service, ask:

1. What capability am I providing? (This defines your interface in `types.ts`)
2. What external system am I integrating with? (Implementation detail)
3. Could I swap this implementation for another? (Test your abstraction)
4. Does my domain need to know how this works? (It shouldn't)
5. Can I express this without classes or inheritance? (Use factory functions)

If you can answer these clearly, you're ready to build a service.

## Example: Complete Service Structure

Here's what a complete service looks like:

```
/services/isbn-lookup/
  types.ts           # Interface + error types
  google-books.ts    # Implementation #1
  open-library.ts    # Implementation #2
  composite.ts       # Composite implementation
  mock.ts            # Mock for testing
  index.ts           # Exports
  package.json
  README.md
```

Each implementation file exports a single `createXYZ` factory function that returns an object implementing the service interface.
