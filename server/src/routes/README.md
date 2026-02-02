# API Routes

HTTP route handlers for RESTful API endpoints.

## Files

- [`api-docs.ts`](api-docs.ts) - API documentation endpoints (OpenAPI spec and Swagger UI)
- [`books.ts`](books.ts) - Book management endpoints (CRUD operations)
- [`people.ts`](people.ts) - People management endpoints (CRUD operations)
- [`entities.ts`](entities.ts) - Entity access management endpoints
- [`health.ts`](health.ts) - Health check and metrics endpoints

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

### People

```
GET    /api/people        - List all people
GET    /api/people/:id    - Get single person
POST   /api/people        - Create new person
PUT    /api/people/:id    - Update person
DELETE /api/people/:id    - Delete person
GET    /api/people/:id/books - List books associated with person
```

### Health & Metrics

```
GET /health            - Health check (database connectivity)
GET /metrics           - Prometheus metrics (text format)
GET /metrics/json      - Metrics snapshot (JSON format)
```

### API Documentation

```
GET /api/docs          - Interactive Swagger UI interface
GET /api/openapi.json  - OpenAPI 3.0 specification
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
