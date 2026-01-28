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

## Utilities

```typescript
import { normalizeISBN, isbn10ToIsbn13, isbn13ToIsbn10 } from '@quailcomp/book-metadata';

normalizeISBN('978-0-13-468599-1');  // "9780134685991"
isbn10ToIsbn13('0134685997');         // "9780134685991"
isbn13ToIsbn10('9780134685991');      // "0134685997"
```
