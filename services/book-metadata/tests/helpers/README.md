# Test Helpers

Shared test utilities for book metadata provider tests.

## Files

- [`provider-test-utils.ts`](provider-test-utils.ts) - Common mocking helpers, sample data, and assertion utilities

## Provider Test Utils

Provides reusable test infrastructure for all provider tests:

### Mock Fetch Functions

Create mock `fetch` implementations for testing providers without network calls:

```typescript
import { createMockFetch, createTimeoutFetch, createNetworkErrorFetch } from '@/tests/helpers/provider-test-utils'

// Mock successful responses
const mockFetch = createMockFetch(new Map([
  ['google', { ok: true, json: async () => ({ items: [...] }) }],
  ['openlibrary', { ok: true, json: async () => ({ title: '...' }) }]
]))
global.fetch = mockFetch

// Mock timeout
global.fetch = createTimeoutFetch()

// Mock network error
global.fetch = createNetworkErrorFetch()
```

### Sample Test Data

Pre-defined ISBN numbers and book metadata for consistent testing:

```typescript
import { sampleISBNs, sampleBookMetadata } from '@/tests/helpers/provider-test-utils'

// Test with common ISBNs
await provider.lookup(sampleISBNs.effectiveJava)
await provider.lookup(sampleISBNs.withHyphens) // Tests normalization
```

### Assertion Utilities

Helper functions to validate provider responses:

```typescript
import {
  expectValidMetadata,
  expectServiceUnavailableError,
  expectTimeoutError,
  expectNotFound
} from '@/tests/helpers/provider-test-utils'

const result = await provider.lookup('9780134685991')
expectValidMetadata(result, 'google-books')
```

## Usage Pattern

Most provider tests follow this pattern:

1. Mock `global.fetch` with predefined responses
2. Call provider method (lookup/search)
3. Assert response using helper functions
4. Restore original fetch in `afterEach`

See individual provider test files in [`../providers/`](../providers/) for examples.
