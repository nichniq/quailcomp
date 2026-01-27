# Domains Directory

This directory contains the authoritative source of truth for each domain in the system. Each domain represents a **bounded context** in Domain-Driven Design terms.

## Purpose

The `/domains` directory serves as:
1. **Living documentation** of each domain's concepts and rules
2. **Type definitions** used throughout the application
3. **Single source of truth** for domain logic and structure

## Philosophy

Each domain combines human-readable explanation with machine-readable specifications. This approach:
- Prevents drift between documentation and implementation
- Reduces cognitive load when learning (no "flip to another page" problem)
- Ensures concepts are explained at the point they're defined
- Makes the domain model accessible to both humans and machines
- Allows direct imports without extraction scripts

## Format

We use TypeScript files (.ts) with long-form Markdown comments. Types are directly importable while documentation lives alongside them.

### File Structure

Each domain is a single TypeScript file: `/domains/<domain-name>.ts`

Example structure:

```typescript
/**
 * # Authentication
 *
 * > Authentication proves user identity through multiple methods.
 *
 * Users can authenticate through passwords, passkeys, OAuth providers, or API keys.
 * Each authentication method produces a UserId that identifies them throughout
 * the system. Authentication is separate from authorization - proving identity is
 * different from determining permissions.
 *
 * ## Sessions
 *
 * > Sessions track authenticated user activity over time.
 *
 * When a user successfully authenticates, we create a session containing their
 * user_id and expiration information. Sessions enable stateless authentication
 * through JWT tokens while maintaining security.
 */

export type UserId = number & { readonly __brand: 'UserId' };

export type Session = {
  session_id: string;
  user_id: UserId;
  created_at: Date;
  expires_at: Date | null;
};

/**
 * ## Authentication Methods
 *
 * > Multiple authentication methods map to a single user identity.
 *
 * The system supports multiple ways to prove identity. Each method stores
 * different credential data but all resolve to the same UserId.
 */

export type AuthMethod = 'password' | 'passkey' | 'oauth' | 'api_key';
```

### Multiple Reading Depths

Support different levels of detail within comments:
- Blockquotes (>): Single-sentence summaries after headers
- Full paragraphs: Detailed explanations
- Inline examples: Show usage patterns
- Edge cases: Document how the model handles real-world messiness

### Comment Formatting

- Use `/** */` block comments for documentation sections
- Write Markdown inside comments (headers, lists, code blocks, etc.)
- Place documentation immediately before related type definitions
- Use blockquotes (>) after headers for summaries

### Type Categories

**Domain Types** - How we think about the domain:
- Entities (aggregate roots)
- Domain events
- Value objects
- Enums and discriminated unions

**Persistence Types** - How data is stored:
- Entity snapshots (JSONB data structure)
- Database row types
- Serialization helpers

**Query Types** - Common query results and projections

## Creating Domain Files

When creating or enhancing domain documentation:

1. Start with concepts: What is this domain about? Why does it exist?
2. Introduce types naturally: Define types after explaining the concept
3. Provide examples: Show how concepts manifest in practice
4. Include summaries: Add blockquote summaries after headers for skimmability
5. Link related domains: Reference other domains when there are relationships
6. Document edge cases: Explain how the model handles messy real-world data

## Current Domains

### Books (`/domains/books.ts`)
Manages physical books in the collection and their acquisition history. Tracks acquisition events (purchased, ordered, given, won, inherited) and references other domains like Locations, People, and Series.

## Future Domains

### Locations (`/domains/locations`)
Places where events happen - bookstores, museums, coffee shops, etc. Referenced by the Books domain and potentially others.

### People/Contacts (`/domains/people`)
Relationships with people who give gifts, lend/borrow items, or are otherwise connected to items in the collection.

### Series (`/domains/series`)
Book series, collections, or multi-volume works. Referenced by individual books.

### Finance (`/domains/finance`)
Financial tracking, expenses, investments, etc.

### Ideas (`/domains/ideas`)
Creative ideas, project concepts, and brainstorming notes (e.g., video game ideas).

## Design Principles

### 1. Bounded Contexts
Each domain is **independent** and can evolve separately. Changes to one domain shouldn't require changes to others (except for interface contracts).

### 2. References Between Domains
Domains reference each other through **IDs only**. For example:
- A book stores `location_id` (not the full Location object)
- A book stores `person_id` (not the full Person object)

This keeps boundaries clean and prevents tight coupling.

### 3. Event Sourcing
Domains primarily work with **events** (things that happened) rather than just current state. This preserves provenance and history.

### 4. Minimal Enforcement
The system acknowledges real-world messiness:
- Most fields are optional
- Historical data may be incomplete
- Invariants are minimal and pragmatic

### 5. Pragmatic DDD
We use DDD concepts where they help (ubiquitous language, bounded contexts, domain events) but avoid ceremony and premature complexity.

## Usage

### Importing Types

```typescript
// Import from single-file domains
import { UserId, Session } from '@/domains/auth'
import { PhysicalBook, AcquisitionEvent } from '@/domains/books'
```

### Reading Documentation

Before working with a domain:
1. Read the domain file to understand concepts and types together
2. Check for cross-references to related domains
3. Review examples and edge cases

### Adding a New Domain

1. Create a single TypeScript file: `/domains/<domain-name>.ts`
2. Write documentation in `/** */` block comments with Markdown
3. Define types immediately after their explanatory documentation
4. Export all types for use throughout the codebase
5. Update this README with the new domain

## Context Map

High-level view of how domains relate:

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

┌─────────────┐
│    Ideas    │─────references?────> People
└─────────────┘
```

## Benefits of Single-File TypeScript Domains

- Direct imports: `import { UserId } from '@/domains/auth'`
- Type checking: Types are validated by TypeScript compiler
- IDE support: Full autocomplete and type hints
- No extraction needed: Documentation and types are already together
- Single source of truth: One file for both humans and machines

## Inspiration

- Literate programming (Donald Knuth)
- Domain-Driven Design ubiquitous language
- Textbook-style integrated diagrams and equations
- TSDoc and JSDoc conventions

## Notes

This structure is **experimental** and will evolve as we learn what works. The goal is to maintain clarity and flexibility while building a system that grows naturally with use.
