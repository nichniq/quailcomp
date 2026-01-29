# Authorization Service

Resource-level permission checks and access control.

## Files

- [`service.ts`](service.ts) - Core authorization logic (permission checks)
- [`middleware.ts`](middleware.ts) - Authorization middleware for route protection
- [`types.ts`](types.ts) - Type definitions for authz domain
- [`index.ts`](index.ts) - Public API exports

## Purpose

Handles authorization decisions after authentication. Determines whether an authenticated user can perform specific actions on specific resources.

## Usage

```typescript
import { requirePermission } from './authz'

// Require specific permission
router.delete('/books/:id',
  requireAuth,
  requirePermission('books', 'delete'),
  async (req, res) => {
    // User has delete permission for books
  }
)

// Check permission programmatically
if (await authzService.can(userId, 'books', 'update', bookId)) {
  // User can update this book
}
```

## Permission Model

- **Resource**: What is being accessed (e.g., 'books', 'users')
- **Action**: What operation is being performed (e.g., 'read', 'write', 'delete')
- **Subject**: Specific resource instance (optional, for fine-grained control)

## Documentation

- [Authorization Domain](../../../../domains/authorization.md)
- [API Reference](../../../docs/reference/api.md)
