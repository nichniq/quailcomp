# Domains Reference

Domain documentation lives in `/domains/*.md` as Markdown files with embedded TypeScript types.

## Current Domains

### [Authentication](/domains/authentication.md)

User identity with multiple authentication methods.

**Key types:** `UserId`, `User`, `Credential`, `Session`, `AuthMethod`

**Concepts:**

- Users can authenticate through passwords, passkeys, OAuth, or API keys
- Each method produces a `UserId` that identifies them throughout the system
- Authentication is separate from authorization

### [Authorization](/domains/authorization.md)

Resource-level permissions with owner/write/read hierarchy.

**Key types:** `Permission`, `ResourcePermission`, `PermissionLevel`

**Concepts:**

- Permissions are per-resource (not role-based)
- Three levels: owner > write > read
- Owner can grant/revoke permissions

### [Books](/domains/books.md)

Physical books in the collection and their acquisition history.

**Key types:** `PhysicalBook`, `AcquisitionEvent`, `AcquisitionMethod`

**Concepts:**

- Books are entities (mutable state)
- Acquisitions are events (immutable facts)
- References Locations, People, and Series domains

## Planned Domains

These domains are documented as placeholders in [/domains/README.md](/domains/README.md):

### Locations

Places where events happen - bookstores, museums, coffee shops. Referenced by Books and other domains.

### People/Contacts

Relationships with people who give gifts, lend/borrow items, or are connected to collection items.

### Series

Book series, collections, or multi-volume works. Referenced by individual books.

### Finance

Financial tracking, expenses, investments.

### Ideas

Creative ideas, project concepts, brainstorming notes.

## Domain Relationships

```
┌─────────────┐
│    Books    │─────references─────> Locations
│             │─────references─────> People
│             │─────references─────> Series
└─────────────┘

┌─────────────┐
│  Locations  │ (standalone)
└─────────────┘

┌─────────────┐
│   People    │ (standalone)
└─────────────┘

┌─────────────┐
│   Series    │ (standalone)
└─────────────┘

┌─────────────┐
│   Finance   │─────references?────> People
└─────────────┘
```

Domains reference each other through **IDs only** to maintain loose coupling.

## Importing Types

Types are automatically extracted from Markdown and generated into `/domains/types/`:

```typescript
import type { UserId, Session } from '@domains/types/authentication'
import type { PhysicalBook, AcquisitionEvent } from '@domains/types/books'
import type { Permission } from '@domains/types/authorization'
```

## Creating New Domains

See [How to Write Domain Documentation](../how-to/write-domain-docs.md) for:

- File structure and format
- Writing style guidelines
- Type extraction details
- Cross-referencing patterns

## Philosophy

The domains directory serves as:

1. **Living documentation** of each domain's concepts and rules
2. **Type definitions** used throughout the application
3. **Single source of truth** for domain logic and structure

See [/domains/README.md](/domains/README.md) for the full philosophy and design principles.
