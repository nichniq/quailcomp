# Book Metadata Service Tests

Unit and integration tests for metadata providers.

## Test Files

Tests are organized by provider:

- Provider-specific tests (e.g., `google-books.test.ts`)
- Composite provider tests
- Mock provider tests
- Utility function tests

## Running Tests

```bash
# From project root
bun test services/book-metadata/tests

# Run specific provider tests
bun test services/book-metadata/tests/google-books.test.ts
```

## Test Strategy

### Unit Tests

Test individual providers in isolation:

- ISBN lookup accuracy
- Title search functionality
- Error handling
- Response parsing

### Integration Tests

Test composite provider behavior:

- Fallback between providers
- Result aggregation
- Timeout handling
- Rate limiting

### Mock Provider

Use mock provider for testing consumers:

```typescript
import { createMockProvider } from '@quailcomp/book-metadata'

// Test with predictable responses
const mock = createMockProvider({
  responses: new Map([
    ['9780134685991', {
      isbn: '9780134685991',
      title: 'Test Book',
      authors: ['Test Author'],
      source: 'google-books',
    }],
  ]),
})

const result = await mock.lookup('9780134685991')
```

## Test Data

Tests use real ISBN numbers for integration tests but mock responses to avoid external API calls during CI/CD.

See [Running Tests](../../../docs/how-to/run-tests.md) for testing conventions.
