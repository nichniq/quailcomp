# @quailcomp/book-metadata

A service for fetching book metadata from multiple providers with automatic fallback.

## Usage

### Quick Start

```typescript
import { createBookMetadataService } from '@quailcomp/book-metadata';

const service = createBookMetadataService({
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY,
  timeout: 5000,
});

const book = await service.lookup('978-0134685991');
if (book) {
  console.log(book.title);   // "Effective Java"
  console.log(book.authors); // ["Joshua Bloch"]
}
```

### Using Individual Providers

```typescript
import {
  createGoogleBooksProvider,
  createOpenLibraryProvider,
  createLibraryOfCongressProvider,
} from '@quailcomp/book-metadata';

const googleBooks = createGoogleBooksProvider({ apiKey: 'your-key' });
const openLibrary = createOpenLibraryProvider();
const loc = createLibraryOfCongressProvider();

const result = await googleBooks.lookup('9780134685991');
```

### Custom Composite Configuration

```typescript
import {
  createCompositeProvider,
  createOpenLibraryProvider,
  createGoogleBooksProvider,
} from '@quailcomp/book-metadata';

// Try OpenLibrary first, then Google Books
const service = createCompositeProvider({
  providers: [
    createOpenLibraryProvider({ timeout: 3000 }),
    createGoogleBooksProvider({ timeout: 5000 }),
  ],
});
```

## Providers

| Provider | API Key Required | Rate Limits | Best For |
|----------|------------------|-------------|----------|
| Google Books | Optional | Higher with key | General lookups |
| OpenLibrary | No | Generous | Older/rare books |
| Library of Congress | No | Unknown | US publications |

## BookMetadata Type

```typescript
interface BookMetadata {
  isbn: string;
  isbn10?: string;
  isbn13?: string;
  lccn?: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  language?: string;
  subjects?: string[];
  thumbnailUrl?: string;
  source: 'google-books' | 'open-library' | 'library-of-congress';
}
```

## Error Handling

```typescript
import {
  ServiceUnavailableError,
  TimeoutError,
  InvalidISBNError,
} from '@quailcomp/book-metadata';

try {
  const result = await service.lookup(isbn);
} catch (error) {
  if (error instanceof InvalidISBNError) {
    // Invalid ISBN format
  } else if (error instanceof TimeoutError) {
    // Request timed out
  } else if (error instanceof ServiceUnavailableError) {
    // All providers failed
  }
}
```

## Testing

```typescript
import { createMockProvider, createFailingMockProvider } from '@quailcomp/book-metadata';

// Mock with predefined responses
const mock = createMockProvider({
  responses: new Map([
    ['9780134685991', {
      isbn: '9780134685991',
      title: 'Test Book',
      authors: ['Test Author'],
      source: 'google-books',
    }],
  ]),
});

// Mock that always fails (for testing fallback)
const failing = createFailingMockProvider('google-books');
```

## Resilience Features

### Rate Limiting

Prevent exceeding API rate limits using the token bucket algorithm:

```typescript
import {
  createGoogleBooksProvider,
  createRateLimitedProvider,
} from '@quailcomp/book-metadata';

const googleBooks = createGoogleBooksProvider({ apiKey: 'your-key' });

// Limit to 10 requests per second with burst capacity of 100
const rateLimited = createRateLimitedProvider(googleBooks, {
  maxTokens: 100,
  refillRate: 10,
});

// Requests automatically throttled to stay within limits
await rateLimited.lookup('9780134685991');
```

### Circuit Breaker

Fail fast when a provider is experiencing issues:

```typescript
import {
  createGoogleBooksProvider,
  createResilientProvider,
} from '@quailcomp/book-metadata';

const googleBooks = createGoogleBooksProvider({ apiKey: 'your-key' });

// Open circuit after 5 failures, attempt recovery after 60 seconds
const resilient = createResilientProvider(googleBooks, {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  successThreshold: 2,
});

try {
  await resilient.lookup('9780134685991');
} catch (error) {
  if (error instanceof ServiceUnavailableError) {
    // Circuit may be open, provider temporarily unavailable
  }
}
```

### Combining Resilience Patterns

Stack multiple resilience patterns together:

```typescript
import {
  createGoogleBooksProvider,
  createRateLimitedProvider,
  createResilientProvider,
} from '@quailcomp/book-metadata';

const googleBooks = createGoogleBooksProvider({ apiKey: 'your-key' });

// Apply rate limiting first
const rateLimited = createRateLimitedProvider(googleBooks, {
  maxTokens: 100,
  refillRate: 10,
});

// Then add circuit breaker protection
const resilient = createResilientProvider(rateLimited, {
  failureThreshold: 5,
  recoveryTimeout: 60000,
});

// Now protected by both rate limiting and circuit breaker
await resilient.lookup('9780134685991');
```

## Utilities

### ISBN Utilities

```typescript
import { normalizeISBN, isbn10ToIsbn13, isbn13ToIsbn10 } from '@quailcomp/book-metadata';

normalizeISBN('978-0-13-468599-1');  // "9780134685991"
isbn10ToIsbn13('0134685997');         // "9780134685991"
isbn13ToIsbn10('9780134685991');      // "0134685997"
```

### Rate Limiter Utility

Use the rate limiter directly for custom scenarios:

```typescript
import { RateLimiter } from '@quailcomp/book-metadata';

const limiter = new RateLimiter({
  maxTokens: 10,
  refillRate: 5, // 5 tokens per second
});

// Wait for token before making request
await limiter.acquire();
await fetch('https://api.example.com/data');

// Check if token is available without waiting
if (limiter.canAcquire()) {
  await limiter.acquire();
  // Make request
}
```

### Circuit Breaker Utility

Use the circuit breaker directly for custom scenarios:

```typescript
import { CircuitBreaker, CircuitOpenError } from '@quailcomp/book-metadata';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 60000,
  successThreshold: 2,
});

try {
  const result = await breaker.execute(async () => {
    const response = await fetch('https://api.example.com/data');
    if (!response.ok) throw new Error('HTTP error');
    return response.json();
  });
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // Circuit is open, service is temporarily unavailable
  }
}

// Check circuit state
console.log(breaker.getState()); // "CLOSED", "OPEN", or "HALF_OPEN"
console.log(breaker.isOpen());   // true or false
```
