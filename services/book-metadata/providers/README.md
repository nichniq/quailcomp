# Book Metadata Providers

External API client implementations for book metadata lookup.

## Provider Files

### API Clients

- [`google-books.ts`](./google-books.ts) - Google Books API client
- [`open-library.ts`](./open-library.ts) - Open Library API client
- [`library-of-congress.ts`](./library-of-congress.ts) - Library of Congress API client
- [`hardcover.ts`](./hardcover.ts) - Hardcover API client
- [`worldcat-classify.ts`](./worldcat-classify.ts) - WorldCat Classify API client
- [`composite.ts`](./composite.ts) - Composite provider with intelligent fallback

### Resilience Wrappers

- [`rate-limited.ts`](./rate-limited.ts) - Rate limiting wrapper using token bucket algorithm
- [`resilient.ts`](./resilient.ts) - Circuit breaker wrapper for failure protection

### Testing

- [`mock.ts`](./mock.ts) - Mock provider for testing

## Provider Interface

Each provider factory returns a service implementing:

```typescript
interface BookMetadataService {
  provider: BookMetadataProvider
  lookup(isbn: string): Promise<BookMetadata | null>
}
```

## Usage

```typescript
import { createCompositeProvider } from './composite'
import { createGoogleBooksProvider } from './google-books'
import { createOpenLibraryProvider } from './open-library'

// Create a composite provider with fallback
const service = createCompositeProvider({
  providers: [
    createGoogleBooksProvider({ apiKey: 'your-key' }),
    createOpenLibraryProvider(),
  ]
})

// Try each provider until one succeeds
const book = await service.lookup('9780134685991')
```

## Composite Provider

The composite provider:

1. Tries providers in order of reliability
2. Falls back to next provider on failure
3. Aggregates results from multiple sources
4. Handles rate limiting and timeouts

## Adding New Providers

1. Create new file in this directory implementing `BookMetadataService`
2. Import from `@/types` and `@/utils` using path aliases
3. Export a `create*Provider` factory function
4. Add to composite provider's default provider list if appropriate
5. Add tests in [`../tests/`](../tests/)

See [Services Architecture](../../../docs/explanation/services-architecture.md) for details.
