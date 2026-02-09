# Provider Tests

Individual test suites for each book metadata provider implementation.

## Test Files

Each file tests a specific provider's functionality:

- [`google-books.test.ts`](google-books.test.ts) - Google Books API provider
- [`hardcover.test.ts`](hardcover.test.ts) - Hardcover API provider (requires API key)
- [`library-of-congress.test.ts`](library-of-congress.test.ts) - Library of Congress provider
- [`open-library.test.ts`](open-library.test.ts) - Open Library API provider
- [`worldcat-classify.test.ts`](worldcat-classify.test.ts) - WorldCat Classify API provider

## Test Coverage

Each provider test suite covers:

### Happy Path

- ISBN lookup returns valid metadata
- Title search returns results
- API-specific features (e.g., API keys, special parameters)

### Response Mapping

- Correct parsing of API responses
- Field transformations (e.g., date formats, language codes)
- Handling optional fields
- Array vs. single value normalization

### Error Handling

- 404 Not Found responses
- Network errors and timeouts
- Service unavailable (5xx) responses
- Invalid API responses

### Edge Cases

- ISBN normalization (hyphens, spaces)
- Missing or malformed data
- Rate limiting
- Multiple author fetches (where applicable)

## Running Tests

```bash
# Run all provider tests
bun test services/book-metadata/tests/providers

# Run specific provider
bun test services/book-metadata/tests/providers/google-books.test.ts
```

## Test Structure

Provider tests use mock `fetch` to avoid real API calls:

```typescript
import { createMockFetch } from '@/tests/helpers/provider-test-utils'

global.fetch = createMockFetch(new Map([
  ['googleapis.com', { ok: true, json: async () => mockResponse }]
]))

const provider = createGoogleBooksProvider()
const result = await provider.lookup('9780134685991')

expect(result).toMatchObject({ title: 'Expected Title' })
```

See [`../helpers/`](../helpers/) for shared test utilities and mock functions.
