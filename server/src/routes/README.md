# API Routes

HTTP route handlers for RESTful API endpoints.

## Files

- [`books.ts`](books.ts) - Book management endpoints (CRUD operations)
- [`health.ts`](health.ts) - Health check endpoint

## Structure

Each route file exports handler functions organized by resource:

```typescript
// books.ts
export const booksRoutes = {
  'GET /books': listBooks,
  'GET /books/:id': getBook,
  'POST /books': createBook,
  'PUT /books/:id': updateBook,
  'DELETE /books/:id': deleteBook,
}
```

## Usage

Routes are registered in [server.ts](../server.ts):

```typescript
import { booksRoutes } from './routes/books'
import { healthRoutes } from './routes/health'

app.use('/api', booksRoutes)
app.use('/health', healthRoutes)
```

## API Endpoints

### Books

```
GET    /api/books       - List all books
GET    /api/books/:id   - Get single book
POST   /api/books       - Create new book
PUT    /api/books/:id   - Update book
DELETE /api/books/:id   - Delete book
```

### Health

```
GET /health            - Health check
```

## Authentication & Authorization

Protected routes require:

1. Authentication middleware (`requireAuth`)
2. Authorization middleware (`requirePermission`)

```typescript
{
  'DELETE /books/:id': compose([
    requireAuth,
    requirePermission('books', 'delete'),
    deleteBook,
  ]),
}
```

## Documentation

- [API Reference](../../../docs/reference/api.md)
- [Books Domain](../../../../domains/books.md)
