# How to Write Domain Documentation

This guide covers creating and updating domain documentation in Quailcomp.

## Overview

Domain documentation lives in `/domains/*.md` as Markdown files with embedded TypeScript types. This approach:

- Keeps documentation and types together
- Prevents drift between docs and implementation
- Auto-generates importable TypeScript files

## Creating a New Domain

### 1. Create the Markdown File

```bash
touch domains/your-domain.md
```

### 2. Write the Documentation

Follow this structure:

```markdown
# Your Domain Name

> One-sentence summary of what this domain represents.

Longer explanation of the domain's purpose, boundaries, and key concepts.
This is where you explain the "why" behind the design decisions.

## Core Concept

> Brief summary for skimming.

Detailed explanation of the concept. Define types after explaining them:

```typescript
export type YourType = {
  id: string;
  name: string;
  createdAt: Date;
};
```

## Another Section

> Summary.

More explanation, then more types as needed.

```

### 3. Extract Types

Types are automatically extracted by the pre-commit hook, but you can run manually:

```bash
bun run domains/scripts/extract-types.ts
```

This generates `/domains/types/your-domain.ts`.

### 4. Import Types

```typescript
import type { YourType } from '@domains/types/your-domain'
```

## Documentation Guidelines

### Structure

- **Title**: Domain name as H1
- **Summary**: Blockquote (`>`) immediately after headers for skimmability
- **Explanation**: Prose explaining concepts before defining types
- **Types**: TypeScript code blocks after explanatory text
- **Examples**: Concrete scenarios showing common and edge cases

### Writing Style

**Write for humans first, types second:**

```markdown
## Sessions

> Sessions track authenticated user activity over time.

When a user successfully authenticates, we create a session containing their
user_id and expiration information. Sessions enable stateless authentication
through JWT tokens while maintaining security.

```typescript
export type Session = {
  session_id: string;
  user_id: UserId;
  created_at: Date;
  expires_at: Date | null;
};
```

```

### Type Categories

**Domain Types** - How we think about the domain:

- Entities (aggregate roots)
- Domain events
- Value objects
- Enums and discriminated unions

**Persistence Types** - How data is stored:

- Entity snapshots (JSONB data structure)
- Database row types

**Query Types** - Common query results and projections

### Cross-Referencing

Reference other domains naturally in prose:

```markdown
Books reference [Locations](/domains/locations.md) for where they were
acquired and [People](/domains/people.md) for who gave them as gifts.
```

In types, use IDs to maintain loose coupling:

```typescript
export type PhysicalBook = {
  entity_id: number;
  location_id?: number;  // References Location domain
  person_id?: number;    // References People domain
};
```

## Type Extraction Details

### How It Works

The extraction script (`domains/scripts/extract-types.ts`):

1. Scans all `.md` files in `/domains`
2. Extracts TypeScript code blocks (fenced with ` ```typescript`)
3. Generates `.ts` files in `/domains/types/`
4. Preserves all exports

### Requirements

- All types must be exported: `export type`, `export interface`
- Code blocks must use ` ```typescript` fence
- Each domain generates one `.ts` file

### Automatic Extraction

The pre-commit hook automatically regenerates types when `.md` files change. You don't need to run extraction manually unless testing.

## Example: Books Domain

Here's a simplified example from the books domain:

```markdown
# Books

> Physical books in the collection with acquisition history.

The Books domain tracks physical books you own. Each book has metadata
(title, author, ISBN) and an acquisition history recording how and when
you obtained it.

## Physical Book

> A book you physically own.

```typescript
export type PhysicalBook = {
  entity_id: number;
  title: string;
  subtitle?: string;
  authors?: string[];
  isbn10?: string;
  isbn13?: string;
  lccn?: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  notes?: string;
};
```

## Acquisition

> How a book came into your possession.

Books are acquired through various methods. The acquisition event records
when, where, and how you obtained the book.

```typescript
export type AcquisitionMethod =
  | 'purchased'
  | 'gift'
  | 'inherited'
  | 'found'
  | 'borrowed';

export type AcquisitionEvent = {
  event_id: number;
  book_id: number;
  method: AcquisitionMethod;
  occurred_at: Date;
  location_id?: number;
  person_id?: number;
  cost?: {
    amount: number;
    currency: string;
  };
};
```

```

## Updating Existing Domains

When updating types:

1. Edit the `.md` file
2. Update both the explanation and the type definition
3. Run tests to verify nothing breaks
4. The pre-commit hook will regenerate types

When concepts evolve:

1. Consider whether this is a new domain or extends an existing one
2. Add new sections for new concepts
3. Cross-reference related domains
4. Update domain README if adding new domains

## Design Principles

### Bounded Contexts

Each domain is independent and can evolve separately. Changes to one domain shouldn't require changes to others.

### References by ID

Domains reference each other through IDs only:

```typescript
// Good - loose coupling
type Book = {
  location_id?: number;
};

// Bad - tight coupling
type Book = {
  location?: Location;
};
```

### Minimal Enforcement

The system acknowledges real-world messiness:

- Most fields are optional
- Historical data may be incomplete
- Invariants are minimal and pragmatic

### Pragmatic DDD

Use DDD concepts where they help (ubiquitous language, bounded contexts, domain events) but avoid ceremony and premature complexity.

## Related

- [Domains README](/domains/README.md) - Philosophy and format details
- [Event Sourcing](../explanation/event-sourcing.md) - Why entities and events
- [Domains Reference](../reference/domains.md) - Current domain index
