# API Reference

This document covers the HTTP API endpoints provided by the Quailcomp server.

## Base URL

```
http://localhost:3000
```

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST /auth/register

Create a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "username": "johndoe"
}
```

**Response (201):**

```json
{
  "user": {
    "userId": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-15T11:30:00Z"
}
```

#### POST /auth/login

Authenticate and receive a token.

**Request:**

```json
{
  "identifier": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**

```json
{
  "user": {
    "userId": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-15T11:30:00Z"
}
```

#### GET /auth/me

Get the current authenticated user.

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "user": {
    "userId": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Books

All book endpoints require authentication.

#### GET /books

List all books for the authenticated user.

**Response (200):**

```json
{
  "books": [
    {
      "entity_id": 1,
      "type": "book",
      "data": {
        "title": "Domain-Driven Design",
        "author": "Eric Evans",
        "isbn": "9780321125215"
      },
      "entered_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### GET /books/:id

Get a single book by ID.

**Response (200):**

```json
{
  "book": {
    "entity_id": 1,
    "type": "book",
    "data": {
      "title": "Domain-Driven Design",
      "author": "Eric Evans",
      "isbn": "9780321125215"
    },
    "entered_at": "2024-01-15T10:30:00Z"
  }
}
```

**Response (404):**

```json
{
  "error": "Book not found"
}
```

#### POST /books

Create a new book.

**Request:**

```json
{
  "title": "Domain-Driven Design",
  "author": "Eric Evans",
  "isbn": "9780321125215",
  "publisher": "Addison-Wesley",
  "publishedDate": "2003-08-20"
}
```

**Response (201):**

```json
{
  "book": {
    "entity_id": 1,
    "type": "book",
    "data": {
      "title": "Domain-Driven Design",
      "author": "Eric Evans",
      "isbn": "9780321125215",
      "publisher": "Addison-Wesley",
      "publishedDate": "2003-08-20"
    },
    "entered_at": "2024-01-15T10:30:00Z"
  }
}
```

#### PUT /books/:id

Update an existing book.

**Request:**

```json
{
  "title": "Domain-Driven Design",
  "author": "Eric Evans",
  "isbn": "9780321125215",
  "notes": "Classic DDD reference"
}
```

**Response (200):**

```json
{
  "book": {
    "entity_id": 1,
    "type": "book",
    "data": {
      "title": "Domain-Driven Design",
      "author": "Eric Evans",
      "isbn": "9780321125215",
      "notes": "Classic DDD reference"
    },
    "entered_at": "2024-01-15T10:35:00Z"
  }
}
```

#### DELETE /books/:id

Soft delete a book.

**Response (200):**

```json
{
  "message": "Book deleted"
}
```

#### POST /books/metadata/lookup

Look up book metadata from external providers.

**Request:**

```json
{
  "identifier": "9780321125215",
  "identifierType": "isbn"
}
```

**Response (200):**

```json
{
  "results": [
    {
      "provider": "google-books",
      "data": {
        "title": "Domain-Driven Design",
        "authors": ["Eric Evans"],
        "isbn13": "9780321125215",
        "publisher": "Addison-Wesley"
      },
      "responseTime": 245
    },
    {
      "provider": "open-library",
      "data": {
        "title": "Domain-Driven Design",
        "authors": ["Eric Evans"],
        "isbn13": "9780321125215"
      },
      "responseTime": 312
    }
  ]
}
```

### Monitoring

These endpoints do not require authentication.

#### GET /health

Health check endpoint.

**Response (200):**

```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### GET /metrics

Observability metrics.

**Response (200):**

```json
{
  "counters": {
    "http_requests_total": 1523
  },
  "histograms": {
    "http_request_duration_ms": {
      "count": 1523,
      "sum": 45670,
      "avg": 29.98
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Error Responses

### 400 Bad Request

```json
{
  "error": "Validation error",
  "details": ["title is required"]
}
```

### 401 Unauthorized

```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "Access denied"
}
```

### 404 Not Found

```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

## Related

- [CLI Reference](cli.md) - Command-line interface
- [Development Setup](../how-to/setup-development.md) - Running the server
- [Environment Variables](environment-variables.md) - Server configuration
