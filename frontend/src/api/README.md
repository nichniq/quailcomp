# API Client

HTTP client for communicating with the backend API.

## Files

- [`client.ts`](client.ts) - Base HTTP client with authentication and error handling
- [`auth.ts`](auth.ts) - Authentication API calls (login, register, logout)
- [`books.ts`](books.ts) - Book API calls (CRUD operations)

## Usage

```typescript
import { authApi } from '@/api/auth'
import { booksApi } from '@/api/books'

// Authentication
const { token, user } = await authApi.login(email, password)
await authApi.register(email, password, name)

// Books
const books = await booksApi.list()
const book = await booksApi.get(bookId)
await booksApi.create(bookData)
await booksApi.update(bookId, bookData)
await booksApi.delete(bookId)
```

## Base Client

The base client handles:

- Request/response interceptors
- Authentication token injection
- Error handling and normalization
- Base URL configuration
- CORS and credentials

```typescript
import { apiClient } from '@/api/client'

// Configured client instance
const response = await apiClient.get('/api/books')
```

## Error Handling

API errors are normalized to a consistent format:

```typescript
try {
  await booksApi.create(book)
} catch (error) {
  // error.message contains user-friendly message
  // error.status contains HTTP status code
  console.error(error.message)
}
```

## Authentication

The client automatically:

- Attaches JWT tokens to requests
- Refreshes tokens when expired
- Redirects to login on 401 responses

## Configuration

API base URL is configured via environment variables:

```
VITE_API_BASE_URL=http://localhost:3000
```

## Documentation

- [API Reference](../../../docs/reference/api.md)
- [Authentication Domain](../../../domains/authentication.md)
