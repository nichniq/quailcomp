# Authorization

> Manages permissions and determines what authenticated users can do with entities.

This domain handles the "what can you do?" question by defining resource-level
permissions for entities. Authorization is separate from authentication - it assumes
the user's identity has already been verified and focuses purely on access control.

**Key Principle**: Authorization operates on `user_id` (from authentication) and
`entity_id` (the resource being accessed). It doesn't care how the user authenticated
(password, passkey, OAuth, API key) - only whether they have permission.

## Authorization vs Authentication

> Authorization answers "What can you do?" while Authentication answers "Who are you?"

Authentication (identity verification) happens first and produces a `user_id`.
Authorization then uses that `user_id` to check permissions for requested operations.

Example flow:

1. User authenticates → receives JWT with `user_id: 1`
2. User requests entity #42 → extract `user_id: 1` from JWT
3. Authorization checks: Does user 1 have access to entity 42?
4. If yes, check: Does their access level meet the required level?
5. Grant or deny the request

This separation allows:

- Permission checks independent of authentication method
- Same access rules for all users regardless of how they logged in
- Easy permission management (grant/revoke access to entities)
- Clear security boundaries (identity vs permissions)

## Entity Access Model

> Permissions are granted per-entity to specific users with hierarchical access levels.

Every entity in the system can have multiple users with access. Each access grant
specifies:

- Which entity (entity_id)
- Which user (user_id)
- What level (owner, write, read)
- When granted (granted_at)
- Who granted it (granted_by)

When a user creates an entity, they automatically receive owner-level access. They
can then grant access to other users at any level.

## Permission Levels

> Three hierarchical access levels define what operations users can perform.

Access levels form a hierarchy: owner > write > read. Higher levels include all
permissions of lower levels.

```typescript
export type AccessLevel = "owner" | "write" | "read"
```

### Permission Hierarchy

> Owner is the highest level, followed by write, then read.

Each level grants specific capabilities:

**Owner (level 3):**

- Full control over the entity
- Read and modify entity data
- Delete or soft-delete the entity
- Grant/revoke access for other users
- Transfer ownership to another user

**Write (level 2):**

- Read entity data
- Modify entity data
- Cannot delete entity
- Cannot change permissions

**Read (level 1):**

- Read entity data only
- Cannot modify
- Cannot delete
- Cannot change permissions

The hierarchy allows permission checks like "does this user have at least write access?"
which returns true for both write and owner levels.

### Access Level Checking

> Check if user's access level meets or exceeds the required level.

Uses the permission hierarchy to determine if a user's access level is sufficient
for an operation that requires a minimum level.

```typescript
const ACCESS_HIERARCHY: Record<AccessLevel, number> = {
  owner: 3,
  write: 2,
  read: 1,
}

export function hasAccess(
  userLevel: AccessLevel,
  requiredLevel: AccessLevel
): boolean {
  return ACCESS_HIERARCHY[userLevel] >= ACCESS_HIERARCHY[requiredLevel]
}
```

Examples:

```typescript
hasAccess('owner', 'read')  // true - owner can do anything
hasAccess('write', 'owner') // false - write cannot do owner actions
hasAccess('read', 'read')   // true - exact match
hasAccess('owner', 'write') // true - owner exceeds write requirement
```

## Entity Access

> An access grant links a user to an entity with a specific permission level.

Each row in the entity_access table represents one user's permission to access
one entity. The same entity can have multiple access grants (multiple users),
and the same user can have access to multiple entities.

**Key fields:**

- entityId, userId: Primary key - one access grant per user per entity
- accessLevel: What the user can do (owner, write, read)
- grantedAt: When access was granted
- grantedBy: Which user granted this access (null for self-granted owner on create)

```typescript
export interface EntityAccess {
  entityId: number
  userId: number
  accessLevel: AccessLevel
  grantedAt: Date
  grantedBy: number | null
}
```

## Access Control Flows

> Common operations for managing permissions.

### Checking Access

To verify a user can perform an operation:

1. Look up access grant for (entity_id, user_id)
2. If no grant exists, user has no access
3. Check if user's access level meets required level using hasAccess()
4. Allow or deny the operation

### Granting Access

Only owners can grant access to other users:

1. Verify requesting user is owner of entity
2. Choose access level to grant (owner, write, or read)
3. Create access grant for target user
4. Record who granted access (granted_by = requesting user)

If an access grant already exists for that user, it updates the access level.

### Revoking Access

Only owners can revoke access:

1. Verify requesting user is owner of entity
2. Delete access grant for target user
3. Cannot revoke own owner access (prevents lockout)
4. Last owner cannot be removed

### Transferring Ownership

Current owner can transfer ownership to another user:

1. Verify requesting user is owner
2. Grant owner access to target user
3. Optionally downgrade requesting user to write or read
4. Entity must always have at least one owner

### Auto-granting on Create

When a user creates an entity:

1. Entity is created with new entity_id
2. System automatically grants owner access to creator
3. granted_by is null (system-granted, not user-granted)

## Error Handling

> Authorization-specific error codes and error class.

All authorization operations throw AuthorizationError with specific codes for
different failure scenarios.

```typescript
export type AuthzErrorCode =
  | "ACCESS_DENIED"
  | "NOT_OWNER"
  | "CANNOT_REVOKE_SELF"
  | "ENTITY_NOT_FOUND"

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: AuthzErrorCode
  ) {
    super(message)
    this.name = "AuthorizationError"
  }
}
```

## Persistence Types

> Types for storing authorization data in the database.

Authorization data is stored in the `entity_access` table. This type represents
the complete database row including system-managed fields.

### Entity Access Row

> The complete database row for an access grant from the entity_access table.

```typescript
export interface EntityAccessRow {
  entity_id: number
  user_id: number
  access_level: AccessLevel
  granted_at: Date
  granted_by: number | null
}
```

## Query Result Types

> Common projections for access control queries.

### Entity with Access

> Entity data joined with the user's access level.

```typescript
export interface EntityWithAccess {
  entityId: number
  entityType: string
  data: unknown
  accessLevel: AccessLevel
}
```

### Access List Item

> Minimal information for listing who has access to an entity.

```typescript
export interface AccessListItem {
  userId: number
  email: string
  username: string | null
  accessLevel: AccessLevel
  grantedAt: Date
  grantedBy: number | null
}
```

## Display Utilities

> Helper functions for presenting authorization information.

### Get Access Level Label

> User-friendly label for access level.

```typescript
export function getAccessLevelLabel(level: AccessLevel): string {
  switch (level) {
    case "owner":
      return "Owner"
    case "write":
      return "Can Edit"
    case "read":
      return "Can View"
  }
}
```

### Get Access Level Description

> Detailed description of what each access level allows.

```typescript
export function getAccessLevelDescription(level: AccessLevel): string {
  switch (level) {
    case "owner":
      return "Full control including deleting and managing access"
    case "write":
      return "Can view and modify but cannot delete or manage access"
    case "read":
      return "Can view only, cannot modify"
  }
}
```

### Get Access Level Icon

> Icon name or symbol for each access level.

Useful for UI display with icon libraries.

```typescript
export function getAccessLevelIcon(level: AccessLevel): string {
  switch (level) {
    case "owner":
      return "crown"
    case "write":
      return "edit"
    case "read":
      return "eye"
  }
}
```

## References to Other Domains

> Authorization integrates with authentication, HTTP request handling, and real-time subscriptions.

### Authentication Domain

**[Authentication](./authentication.md)** - User identity verification:

Authorization operates on `user_id` values obtained from authentication. See the
Authentication domain for how users prove their identity and receive JWTs containing
their `user_id`.

### HTTP Domain

**[HTTP](./http.md)** - Request context integration:

- `RequestContext.user` provides the authenticated user for authorization checks
- Authorization middleware runs after authentication to verify entity access
- Handlers receive `RequestContext` with both user identity and database connection
- Every entity access check uses `user.user_id` from the request context

### WebSocket Domain

**[WebSocket](./websocket.md)** - Real-time subscription authorization:

- Subscription requests verify user has read access to requested entity types
- Entity updates only broadcast to users with appropriate access levels
- WebSocket authentication provides `user_id` for ongoing authorization checks
- Access revocation can trigger subscription termination for affected entities

## Invariants

> Rules that must be maintained.

**Hard Invariants** (enforced by system):

1. Every entity must have at least one owner
2. Each (entity_id, user_id) pair has at most one access grant
3. Access levels are one of: owner, write, read
4. Owner cannot revoke their own access if they're the last owner
5. Only owners can grant or revoke access
6. Only owners can delete entities

**Soft Expectations** (usually true, not enforced):

- Most entities have exactly one owner (the creator)
- Shared entities typically have 2-5 users with access
- Write and read access is granted deliberately, not by default
- Access grants are long-lived (not frequently added/removed)

## Use Cases

> Primary ways this domain is used.

**Primary Use Cases:**

1. Check if user can access an entity (on every request)
2. List all entities a user can access (for browsing/search)
3. Grant access to share an entity with another user
4. Revoke access to unshare an entity
5. Transfer ownership to another user
6. List who has access to an entity (for management UI)
7. Auto-grant owner access when user creates entity

**Key Queries:**

- Check access: SELECT access_level WHERE entity_id = ? AND user_id = ?
- List accessible entities: SELECT * FROM entities JOIN entity_access WHERE user_id = ?
- List entity accessors: SELECT * FROM entity_access WHERE entity_id = ?
- Check if owner: SELECT 1 WHERE entity_id = ? AND user_id = ? AND access_level = 'owner'
- Count owners: SELECT COUNT(*) WHERE entity_id = ? AND access_level = 'owner'

**Example: Entity with Multiple Users**

Entity #42 (a book) with three users at different access levels:

```js
const entity = {
  entityId: 42,
  entityType: 'book',
  data: {
    title: 'The Design of Everyday Things',
    author: 'Don Norman'
  }
}

const accessGrants = [
  {
    entityId: 42,
    userId: 1,
    accessLevel: 'owner',
    grantedAt: new Date('2026-01-15'),
    grantedBy: null  // Auto-granted on create
  },
  {
    entityId: 42,
    userId: 2,
    accessLevel: 'write',
    grantedAt: new Date('2026-01-20'),
    grantedBy: 1  // Granted by user 1 (the owner)
  },
  {
    entityId: 42,
    userId: 3,
    accessLevel: 'read',
    grantedAt: new Date('2026-01-22'),
    grantedBy: 1  // Granted by user 1 (the owner)
  }
]
```

In this example:

- User 1 (owner) can do anything: view, edit, delete, manage access
- User 2 (write) can view and edit the book but cannot delete it or change permissions
- User 3 (read) can only view the book, no modifications allowed

**Example: Permission Checking**

```js
// User 2 tries to edit entity 42
const userAccess = await getAccessLevel(userId: 2, entityId: 42)
// Returns: 'write'

const canEdit = hasAccess(userAccess, 'write')
// Returns: true - write level meets write requirement

// User 2 tries to delete entity 42
const canDelete = hasAccess(userAccess, 'owner')
// Returns: false - write level doesn't meet owner requirement

// User 3 tries to view entity 42
const userAccess3 = await getAccessLevel(userId: 3, entityId: 42)
// Returns: 'read'

const canView = hasAccess(userAccess3, 'read')
// Returns: true - read level meets read requirement
```
