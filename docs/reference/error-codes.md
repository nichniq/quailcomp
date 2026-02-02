# Error Codes Reference

This document lists all error codes used by the Quailcomp API.

## Error Response Format

All error responses follow this standardized format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": { /* optional additional context */ },
  "path": "/api/endpoint",
  "requestId": "req_123abc"
}
```

### Fields

- **error** (string, required): Human-readable error message describing what went wrong
- **code** (string, required): Machine-readable error code in UPPER_SNAKE_CASE format
- **details** (object, optional): Additional context about the error (e.g., validation field errors)
- **path** (string, optional): The API path where the error occurred
- **requestId** (string, optional): Unique request ID for tracking and debugging

## HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 400 | Bad Request | Invalid input, malformed JSON, validation errors |
| 401 | Unauthorized | Authentication required or authentication failed |
| 403 | Forbidden | Authenticated but lacks required permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource (e.g., email already exists) |
| 500 | Internal Server Error | Unexpected server error |

---

## Error Codes by Category

### Authentication Errors (401)

Errors related to user authentication and credentials.

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `EMAIL_EXISTS` | 409 | Email already exists | Registration failed - email is already registered |
| `USERNAME_EXISTS` | 409 | Username already exists | Registration failed - username is already taken |
| `INVALID_CREDENTIALS` | 401 | Invalid credentials | Login failed - email/username or password incorrect |
| `PASSWORD_TOO_SHORT` | 400 | Password too short | Password doesn't meet minimum length requirement |
| `PASSWORD_TOO_WEAK` | 400 | Password too weak | Password doesn't meet complexity requirements |
| `INVALID_EMAIL` | 400 | Invalid email format | Email format is invalid |
| `USER_NOT_FOUND` | 404 | User not found | User does not exist |
| `CREDENTIAL_INACTIVE` | 401 | Credential inactive | Credential has been deactivated |
| `UNAUTHORIZED` | 401 | Authentication required | No authentication token provided |

### Authorization Errors (403)

Errors related to access control and permissions.

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `ACCESS_DENIED` | 403 | Access denied | User lacks required permission level for this resource |
| `NOT_OWNER` | 403 | Not owner | Action requires owner access level |
| `CANNOT_REVOKE_SELF` | 403 | Cannot revoke own access | Cannot revoke your own owner access |
| `ENTITY_NOT_FOUND` | 404 | Entity not found | Entity does not exist in authorization system |
| `FORBIDDEN` | 403 | Forbidden | Generic forbidden error |

### Validation Errors (400)

Errors related to input validation.

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `VALIDATION_ERROR` | 400 | Validation failed | One or more fields failed validation (includes details.fields array) |
| `INVALID_ID` | 400 | Invalid ID | ID parameter is not a valid number |
| `INVALID_BODY` | 400 | Invalid JSON body | Request body is not valid JSON |
| `MISSING_NAME` | 400 | Name is required | Name field is missing or empty |
| `MISSING_RELATIONSHIPS` | 400 | At least one relationship is required | Relationships array is empty |
| `INVALID_ISBN` | 400 | Invalid ISBN format | ISBN format is invalid |
| `INVALID_FORMAT` | 400 | Invalid format | Generic format validation error |
| `MISSING_FIELDS` | 400 | Missing required fields | One or more required fields are missing |
| `BAD_REQUEST` | 400 | Bad request | Generic bad request error |

### Database Errors (500)

Errors related to database operations.

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `UNIQUE_VIOLATION` | 409 | Duplicate value | Unique constraint violated (e.g., duplicate key) |
| `FOREIGN_KEY_VIOLATION` | 400 | Invalid reference | Foreign key constraint violated (referenced entity doesn't exist) |
| `NOT_NULL_VIOLATION` | 400 | Required field missing | Not null constraint violated |
| `CHECK_VIOLATION` | 400 | Constraint violated | Check constraint violated |
| `CONNECTION_ERROR` | 500 | Database connection failed | Cannot connect to database |
| `QUERY_ERROR` | 500 | Database query failed | Generic database query error |

### Resource Errors (404)

Errors when resources are not found.

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `NOT_FOUND` | 404 | Not found | Generic resource not found error |

### Service Errors (503)

Errors from external services (e.g., book metadata providers).

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `SERVICE_UNAVAILABLE` | 503 | Service unavailable | External service is unavailable |
| `TIMEOUT` | 408 | Request timeout | Request exceeded timeout limit |

### Import/Export Errors (400, 500)

Errors during bulk operations.

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `PARSE_ERROR` | 400 | Parse error | Failed to parse import file |
| `EXPORT_ERROR` | 500 | Export failed | Failed to generate export file |
| `EMPTY_FILE` | 400 | Empty file | Import file is empty |
| `UNSUPPORTED_FORMAT` | 400 | Unsupported format | File format is not supported |
| `MISSING_FILE` | 400 | Missing file | No file provided for import |

### Frontend Errors (Client-Side)

Errors that occur on the frontend before reaching the server.

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `NETWORK_ERROR` | 0 | Network error | Network request failed (no response from server) |
| `TIMEOUT` | 408 | Request timeout | Request exceeded client-side timeout |

### General Errors (500)

Generic errors.

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `INTERNAL_ERROR` | 500 | Internal server error | Unexpected server error |
| `UNKNOWN_ERROR` | 500 | Unknown error | Unexpected error with no specific code |

---

## Validation Error Format

When `code` is `VALIDATION_ERROR`, the `details` object contains a `fields` array with field-level errors:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": [
      {
        "field": "name",
        "message": "name is required",
        "value": ""
      },
      {
        "field": "email",
        "message": "email must be a valid email address",
        "value": "invalid-email"
      }
    ]
  },
  "path": "/api/people",
  "requestId": "req_abc123"
}
```

### Validation Error Fields

- **field** (string): The name of the field that failed validation
- **message** (string): Human-readable validation error message
- **value** (any, optional): The invalid value that was provided

---

## Example Error Responses

### Invalid ID

```http
GET /api/books/abc
```

```json
{
  "error": "Invalid book ID",
  "code": "INVALID_ID",
  "path": "/api/books/abc",
  "requestId": "req_123"
}
```

### Not Found

```http
GET /api/books/999999
```

```json
{
  "error": "Book not found",
  "code": "NOT_FOUND",
  "path": "/api/books/999999",
  "requestId": "req_124"
}
```

### Validation Error

```http
POST /api/people
Content-Type: application/json

{
  "name": "",
  "relationships": []
}
```

```json
{
  "error": "Invalid person data",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": [
      {
        "field": "name",
        "message": "name must be at least 1 characters",
        "value": ""
      },
      {
        "field": "relationships",
        "message": "relationships must not be empty",
        "value": []
      }
    ]
  },
  "path": "/api/people",
  "requestId": "req_125"
}
```

### Authentication Required

```http
GET /api/books
```

```json
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED",
  "path": "/api/books",
  "requestId": "req_126"
}
```

### Access Denied

```http
DELETE /api/books/123
Authorization: Bearer <token-with-read-only-access>
```

```json
{
  "error": "Access denied",
  "code": "ACCESS_DENIED",
  "path": "/api/books/123",
  "requestId": "req_127"
}
```

### Duplicate Resource

```http
POST /auth/register
Content-Type: application/json

{
  "email": "existing@example.com",
  "password": "password123"
}
```

```json
{
  "error": "Email already exists",
  "code": "EMAIL_EXISTS",
  "path": "/auth/register",
  "requestId": "req_128"
}
```

---

## Client-Side Error Handling

### Frontend Error Classes

The frontend provides typed error classes for handling API errors:

```typescript
import { ApiError, NetworkError, TimeoutError } from '@/api/errors';

const { data, error } = await api.get('/books/123');

if (error) {
  if (error.isAuthError()) {
    // Handle authentication error (401)
    // User is automatically redirected to login
  } else if (error.isValidationError()) {
    // Handle validation errors
    const fields = error.details?.fields;
  } else if (error instanceof TimeoutError) {
    // Handle timeout
  } else if (error instanceof NetworkError) {
    // Handle network error
  }
}
```

### Error Helper Methods

All `ApiError` instances provide these helper methods:

- **is(code: string)**: Check if error matches a specific error code
- **isAuthError()**: Check if error is authentication-related (401)
- **isAuthzError()**: Check if error is authorization-related (403)
- **isValidationError()**: Check if error is validation-related
- **isNotFoundError()**: Check if error is not found (404)

---

## Best Practices

### For API Consumers

1. **Always check error responses**: Don't assume requests succeed
2. **Use error codes, not messages**: Error messages may change; codes are stable
3. **Handle validation errors gracefully**: Display field-level errors to users
4. **Log requestId for debugging**: Include in support requests
5. **Implement retry logic**: For `TIMEOUT` and `NETWORK_ERROR` errors

### For API Developers

1. **Use specific error codes**: Avoid generic `BAD_REQUEST` when possible
2. **Include helpful details**: Add context in the `details` field
3. **Be consistent**: Use the same error code for the same error condition
4. **Document new codes**: Update this reference when adding new error codes
5. **Use helper functions**: Use error response helpers to reduce boilerplate

---

## See Also

- [API Reference](./api.md) - Complete API endpoint documentation
- [Server Error Handling](../../server/src/middleware/error-handler.ts) - Error handler implementation
- [Frontend Error Handling](../../frontend/src/api/errors.ts) - Frontend error classes
