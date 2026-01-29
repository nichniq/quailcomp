# Types

TypeScript type definitions for the frontend application.

## Files

- [`auth.ts`](auth.ts) - Authentication and user types
- [`books.ts`](books.ts) - Book and metadata types

## Purpose

Provides type safety for frontend components, stores, and API clients. Types are derived from:

1. Backend API response shapes
2. Domain models from [`domains/`](../../../domains/)
3. Frontend-specific UI state

## Usage

```typescript
import type { User, LoginCredentials } from '@/types/auth'
import type { Book, BookFormData } from '@/types/books'

// In components
const user: User = {
  id: '123',
  email: 'user@example.com',
  name: 'John Doe'
}

const book: Book = {
  id: '456',
  title: 'Domain Driven Design',
  author: 'Eric Evans',
  isbn: '9780321125217'
}
```

## Type Organization

### Auth Types

User authentication and authorization:

```typescript
type User = {
  id: string
  email: string
  name: string
}

type LoginCredentials = {
  email: string
  password: string
}
```

### Book Types

Book entities and metadata:

```typescript
type Book = {
  id: string
  title: string
  author: string
  isbn?: string
  publisher?: string
  publishedDate?: string
}

type BookFormData = Omit<Book, 'id'>
```

## Domain Type Integration

Frontend types can import from domain types:

```typescript
import type { User } from '@quailcomp/domains/types/authentication'
import type { Book } from '@quailcomp/domains/types/books'
```

This ensures consistency between frontend and backend.

## Documentation

- [Domain Types](../../../domains/types/)
- [API Client](../api/)
- [Stores](../stores/)
