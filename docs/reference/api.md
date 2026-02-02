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

#### POST /books/import

Bulk import books from CSV, JSON, or XLSX files.

**Request (multipart/form-data):**

- `file`: The file to import (CSV, JSON, or XLSX)
- `format`: One of `csv`, `json`, or `xlsx`

**CSV Example:**

```csv
title,author,isbn13,note
The Hobbit,J.R.R. Tolkien,9780547928241,Great book
The Fellowship of the Ring,J.R.R. Tolkien,9780544003415,Part 1
```

**JSON Example:**

```json
[
  {
    "title": "The Hobbit",
    "author": "J.R.R. Tolkien",
    "isbn13": "9780547928241",
    "note": "Great book"
  },
  {
    "title": "The Fellowship of the Ring",
    "author": "J.R.R. Tolkien",
    "isbn13": "9780544003415",
    "note": "Part 1"
  }
]
```

**Response (201):**

```json
{
  "imported": [
    {
      "entityId": 1,
      "data": {
        "title": "The Hobbit",
        "author": "J.R.R. Tolkien",
        "isbn13": "9780547928241",
        "note": "Great book"
      }
    },
    {
      "entityId": 2,
      "data": {
        "title": "The Fellowship of the Ring",
        "author": "J.R.R. Tolkien",
        "isbn13": "9780544003415",
        "note": "Part 1"
      }
    }
  ],
  "count": 2,
  "total": 2
}
```

**Error Response (400):**

```json
{
  "error": "Failed to parse file: Invalid CSV format",
  "code": "PARSE_ERROR"
}
```

**Supported CSV Headers:**

The CSV parser recognizes multiple variations of column names (case-insensitive):

- `title`, `Title`
- `author`, `Author`
- `isbn13`, `ISBN-13`, `ISBN`, `isbn`
- `isbn10`, `ISBN-10`
- `series_id`, `seriesid`, `series`, `Series ID`
- `lccn`, `LCCN`
- `note`, `notes`, `Note`, `Notes`

#### GET /books/export

Export all accessible books to CSV, JSON, or XLSX format.

**Query Parameters:**

- `format`: One of `csv`, `json`, or `xlsx` (default: `json`)

**Example Request:**

```
GET /books/export?format=csv
```

**Response (200):**

Returns a file download with appropriate content type:

- CSV: `text/csv` with filename `books-{timestamp}.csv`
- JSON: `application/json` with filename `books-{timestamp}.json`
- XLSX: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with filename `books-{timestamp}.xlsx`

**CSV Export Format:**

```csv
entity_id,title,subtitle,author,series_id,isbn10,isbn13,lccn,note
1,The Hobbit,,J.R.R. Tolkien,,0547928246,9780547928241,,Great book
2,The Fellowship of the Ring,The Lord of the Rings Part 1,J.R.R. Tolkien,,,9780544003415,,
```

**JSON Export Format:**

```json
[
  {
    "entity_id": 1,
    "title": "The Hobbit",
    "author": "J.R.R. Tolkien",
    "isbn10": "0547928246",
    "isbn13": "9780547928241",
    "note": "Great book"
  },
  {
    "entity_id": 2,
    "title": "The Fellowship of the Ring",
    "subtitle": "The Lord of the Rings Part 1",
    "author": "J.R.R. Tolkien",
    "isbn13": "9780544003415"
  }
]
```

#### PUT /books/batch

Batch update multiple books in a single request.

**Request:**

```json
{
  "updates": [
    {
      "entity_id": 1,
      "data": {
        "note": "Updated note"
      }
    },
    {
      "entity_id": 2,
      "data": {
        "note": "Another update"
      }
    }
  ]
}
```

**Response (200):**

```json
{
  "results": [
    {
      "entity_id": 1,
      "success": true,
      "data": {
        "entityId": 1,
        "data": {
          "title": "The Hobbit",
          "author": "J.R.R. Tolkien",
          "note": "Updated note"
        }
      }
    },
    {
      "entity_id": 2,
      "success": true,
      "data": {
        "entityId": 2,
        "data": {
          "title": "The Fellowship of the Ring",
          "note": "Another update"
        }
      }
    }
  ],
  "success": 2,
  "failed": 0
}
```

**Partial Success Response:**

If some updates fail (e.g., due to permissions or non-existent books):

```json
{
  "results": [
    {
      "entity_id": 1,
      "success": true,
      "data": { ... }
    },
    {
      "entity_id": 999,
      "error": "Not found"
    },
    {
      "entity_id": 3,
      "error": "Forbidden - no write access"
    }
  ],
  "success": 1,
  "failed": 2
}
```

**Notes:**

- Each update is a partial update - only provided fields are modified
- Authorization is checked per book - user must have write access
- Updates are applied sequentially, not in a transaction
- Failed updates don't prevent other updates from succeeding

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
