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

### People

All people endpoints require authentication. Authorization is enforced per person entity.

#### GET /people

List all people the authenticated user has access to.

**Response (200):**

```json
{
  "people": [
    {
      "entity_id": 1,
      "data": {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "relationships": ["gift_giver", "author"]
      },
      "entered_at": "2024-02-01T10:30:00Z"
    }
  ]
}
```

#### GET /people/:id

Get a single person by ID.

**Parameters:**

- `id` (path): Entity ID of the person

**Authorization:** Requires read access to the person

**Response (200):**

```json
{
  "person": {
    "entity_id": 1,
    "data": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1-555-0123",
      "notes": "Author friend from college",
      "relationships": ["gift_giver", "author"]
    },
    "entered_at": "2024-02-01T10:30:00Z"
  }
}
```

**Response (403):**

```json
{
  "error": "Forbidden - no read access to this person"
}
```

**Response (404):**

```json
{
  "error": "Person not found"
}
```

#### POST /people

Create a new person. The creator is automatically granted owner access.

**Request:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1-555-0123",
  "notes": "Author friend from college",
  "relationships": ["gift_giver", "author"]
}
```

**Required Fields:**

- `name`: Person's full name

**Optional Fields:**

- `email`: Email address
- `phone`: Phone number
- `notes`: Additional notes
- `relationships`: Array of relationship types

**Relationship Types:**

- `author` - Book author
- `contributor` - Book contributor
- `gift_giver` - Gave books as gifts
- `borrower` - Borrowed books
- `other` - Other relationship

**Response (201):**

```json
{
  "person": {
    "entity_id": 1,
    "data": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1-555-0123",
      "notes": "Author friend from college",
      "relationships": ["gift_giver", "author"]
    },
    "entered_at": "2024-02-01T10:30:00Z"
  }
}
```

**Response (400):**

```json
{
  "error": "Validation error",
  "details": ["name is required"]
}
```

#### PUT /people/:id

Update an existing person.

**Authorization:** Requires write access to the person

**Request:**

```json
{
  "email": "jane.doe@example.com",
  "notes": "Updated contact information"
}
```

**Notes:**

- Partial update - only provided fields are modified
- All fields from POST are valid for updates

**Response (200):**

```json
{
  "person": {
    "entity_id": 1,
    "data": {
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "phone": "+1-555-0123",
      "notes": "Updated contact information",
      "relationships": ["gift_giver", "author"]
    },
    "entered_at": "2024-02-01T10:35:00Z"
  }
}
```

**Response (403):**

```json
{
  "error": "Forbidden - no write access to this person"
}
```

#### DELETE /people/:id

Soft delete a person. The person data is preserved but marked as deleted.

**Authorization:** Requires owner access to the person

**Response (204):**

No content - deletion successful

**Response (403):**

```json
{
  "error": "Forbidden - only owner can delete"
}
```

#### GET /people/:id/books

List all books associated with this person (as gift-giver, borrower, etc.).

**Authorization:** Requires read access to the person

**Response (200):**

```json
{
  "books": [
    {
      "entity_id": 42,
      "data": {
        "title": "The Hobbit",
        "author": "J.R.R. Tolkien",
        "acquisition": {
          "type": "given",
          "person_id": 1,
          "date": "2024-01-15"
        }
      },
      "relationship": "gift_giver",
      "entered_at": "2024-01-16T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Series

All series endpoints require authentication. Authorization is enforced per series entity.

#### GET /series

List all series the authenticated user has access to.

**Response (200):**

```json
{
  "series": [
    {
      "entity_id": 1,
      "data": {
        "name": "The Lord of the Rings",
        "total_volumes": 3,
        "notes": "Classic fantasy trilogy"
      },
      "entered_at": "2024-02-01T10:30:00Z"
    }
  ]
}
```

#### GET /series/:id

Get a single series by ID.

**Parameters:**

- `id` (path): Entity ID of the series

**Authorization:** Requires read access to the series

**Response (200):**

```json
{
  "series": {
    "entity_id": 1,
    "data": {
      "name": "The Lord of the Rings",
      "total_volumes": 3,
      "notes": "Classic fantasy trilogy"
    },
    "entered_at": "2024-02-01T10:30:00Z"
  }
}
```

**Response (403):**

```json
{
  "error": "Forbidden - no read access to this series"
}
```

**Response (404):**

```json
{
  "error": "Series not found"
}
```

#### POST /series

Create a new series. The creator is automatically granted owner access.

**Request:**

```json
{
  "name": "The Lord of the Rings",
  "total_volumes": 3,
  "notes": "Classic fantasy trilogy"
}
```

**Required Fields:**

- `name`: Series name

**Optional Fields:**

- `total_volumes`: Expected total number of volumes
- `notes`: Additional notes about the series

**Response (201):**

```json
{
  "series": {
    "entity_id": 1,
    "data": {
      "name": "The Lord of the Rings",
      "total_volumes": 3,
      "notes": "Classic fantasy trilogy"
    },
    "entered_at": "2024-02-01T10:30:00Z"
  }
}
```

**Response (400):**

```json
{
  "error": "Validation error",
  "details": ["name is required"]
}
```

#### PUT /series/:id

Update an existing series.

**Authorization:** Requires write access to the series

**Request:**

```json
{
  "total_volumes": 4,
  "notes": "Including The Silmarillion"
}
```

**Notes:**

- Partial update - only provided fields are modified
- All fields from POST are valid for updates

**Response (200):**

```json
{
  "series": {
    "entity_id": 1,
    "data": {
      "name": "The Lord of the Rings",
      "total_volumes": 4,
      "notes": "Including The Silmarillion"
    },
    "entered_at": "2024-02-01T10:35:00Z"
  }
}
```

**Response (403):**

```json
{
  "error": "Forbidden - no write access to this series"
}
```

#### DELETE /series/:id

Soft delete a series. The series data is preserved but marked as deleted.

**Authorization:** Requires owner access to the series

**Response (204):**

No content - deletion successful

**Response (403):**

```json
{
  "error": "Forbidden - only owner can delete"
}
```

#### GET /series/:id/books

List all books in this series, ordered by volume number.

**Authorization:** Requires read access to the series

**Response (200):**

```json
{
  "books": [
    {
      "entity_id": 10,
      "data": {
        "title": "The Fellowship of the Ring",
        "author": "J.R.R. Tolkien",
        "series_id": 1,
        "volume_number": 1
      },
      "entered_at": "2024-01-10T10:00:00Z"
    },
    {
      "entity_id": 11,
      "data": {
        "title": "The Two Towers",
        "author": "J.R.R. Tolkien",
        "series_id": 1,
        "volume_number": 2
      },
      "entered_at": "2024-01-10T10:05:00Z"
    },
    {
      "entity_id": 12,
      "data": {
        "title": "The Return of the King",
        "author": "J.R.R. Tolkien",
        "series_id": 1,
        "volume_number": 3
      },
      "entered_at": "2024-01-10T10:10:00Z"
    }
  ],
  "count": 3
}
```

**Notes:**

- Books are automatically sorted by `volume_number` if present
- Books without `volume_number` appear at the end

### WebSocket Real-time Updates

The WebSocket endpoint provides real-time notifications for entity changes.

#### WS /ws

Establish a WebSocket connection for real-time entity updates.

**Authentication:** JWT token required via query parameter

**Connection:**

```javascript
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);
```

**Client → Server Messages:**

Subscribe to entity updates:

```json
{
  "type": "subscribe",
  "entityId": "123"
}
```

Unsubscribe from entity updates:

```json
{
  "type": "unsubscribe",
  "entityId": "123"
}
```

Ping (keepalive):

```json
{
  "type": "ping"
}
```

**Server → Client Messages:**

Pong response:

```json
{
  "type": "pong",
  "timestamp": "2024-02-01T10:30:00Z"
}
```

Entity created:

```json
{
  "type": "entity.created",
  "entityId": 123,
  "entityType": "book",
  "data": {
    "title": "New Book",
    "author": "Author Name"
  },
  "timestamp": "2024-02-01T10:30:00Z"
}
```

Entity updated:

```json
{
  "type": "entity.updated",
  "entityId": 123,
  "entityType": "book",
  "data": {
    "title": "Updated Title",
    "author": "Author Name",
    "note": "Added note"
  },
  "timestamp": "2024-02-01T10:31:00Z"
}
```

Entity deleted:

```json
{
  "type": "entity.deleted",
  "entityId": 123,
  "entityType": "book",
  "timestamp": "2024-02-01T10:32:00Z"
}
```

**Authorization:**

- JWT token is validated on connection
- Subscription requests check read access to the entity
- Clients only receive updates for entities they have access to
- Invalid subscriptions are silently ignored

**Example Usage:**

```javascript
const ws = new WebSocket(`ws://localhost:3000/ws?token=${authToken}`);

ws.onopen = () => {
  console.log('WebSocket connected');

  // Subscribe to book updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    entityId: '123'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'pong':
      console.log('Pong received');
      break;

    case 'entity.created':
      console.log('Entity created:', message.entityId, message.data);
      break;

    case 'entity.updated':
      console.log('Entity updated:', message.entityId, message.data);
      // Update UI with new data
      break;

    case 'entity.deleted':
      console.log('Entity deleted:', message.entityId);
      // Remove from UI
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
  // Implement reconnection logic
};

// Unsubscribe when done
ws.send(JSON.stringify({
  type: 'unsubscribe',
  entityId: '123'
}));
```

**Connection Management:**

- Keep-alive pings recommended every 30 seconds
- Server may close idle connections after 5 minutes
- Implement exponential backoff for reconnection
- Resubscribe to entities after reconnection

**Security Notes:**

- JWT token must be valid and not expired
- Token is checked on initial connection only
- If token expires, connection will be closed
- Refresh token and reconnect as needed

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
