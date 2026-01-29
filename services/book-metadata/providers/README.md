# Book Metadata Providers

External API client implementations for book metadata lookup.

## Provider Files

Located in the parent directory:

- [`google-books.ts`](../google-books.ts) - Google Books API client
- [`open-library.ts`](../open-library.ts) - Open Library API client
- [`library-of-congress.ts`](../library-of-congress.ts) - Library of Congress API client
- [`hardcover.ts`](../hardcover.ts) - Hardcover API client
- [`worldcat-classify.ts`](../worldcat-classify.ts) - WorldCat Classify API client
- [`composite.ts`](../composite.ts) - Composite provider with intelligent fallback
- [`mock.ts`](../mock.ts) - Mock provider for testing

## Provider Interface

Each provider implements a common interface:

```typescript
interface MetadataProvider {
  name: string
  search(query: SearchQuery): Promise<BookMetadata[]>
  getByISBN(isbn: string): Promise<BookMetadata | null>
  getByTitle(title: string): Promise<BookMetadata[]>
}
```

## Usage

```typescript
import { compositeProvider } from '../composite'

// Search across all providers with fallback
const results = await compositeProvider.search({
  isbn: '9780134685991'
})

// Try each provider until one succeeds
const book = await compositeProvider.getByISBN('9780134685991')
```

## Composite Provider

The composite provider:

1. Tries providers in order of reliability
2. Falls back to next provider on failure
3. Aggregates results from multiple sources
4. Handles rate limiting and timeouts

## Adding New Providers

1. Create new file implementing the provider interface
2. Add to composite provider's provider list
3. Update tests in [`tests/`](../tests/)

See [Services Architecture](../../../docs/explanation/services-architecture.md) for details.
