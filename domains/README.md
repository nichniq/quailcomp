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
- Auto-generates TypeScript types from markdown documentation

## Format

We use Markdown files (.md) with TypeScript code blocks. Types are automatically extracted and generated into importable TypeScript files.

### File Structure

Each domain is a single Markdown file: `/domains/<domain-name>.md`

Example structure:

```markdown
# Authentication

> Authentication proves user identity through multiple methods.

Users can authenticate through passwords, passkeys, OAuth providers, or API keys.
Each authentication method produces a UserId that identifies them throughout
the system. Authentication is separate from authorization - proving identity is
different from determining permissions.

## Sessions

> Sessions track authenticated user activity over time.

When a user successfully authenticates, we create a session containing their
user_id and expiration information. Sessions enable stateless authentication
through JWT tokens while maintaining security.

```typescript
export type UserId = number & { readonly __brand: 'UserId' };

export type Session = {
  session_id: string;
  user_id: UserId;
  created_at: Date;
  expires_at: Date | null;
};
```

## Authentication Methods

> Multiple authentication methods map to a single user identity.

The system supports multiple ways to prove identity. Each method stores
different credential data but all resolve to the same UserId.

```typescript
export type AuthMethod = 'password' | 'passkey' | 'oauth' | 'api_key';
```

### Multiple Reading Depths

Support different levels of detail:

- Blockquotes (>): Single-sentence summaries after headers
- Full paragraphs: Detailed explanations
- Inline examples: Show usage patterns
- Edge cases: Document how the model handles real-world messiness

### Markdown Formatting

- Use Markdown headers (#, ##, ###) to structure the document
- Use blockquotes (>) after headers for summaries
- Place TypeScript type definitions in code blocks immediately after their explanation
- Use standard Markdown features (lists, code blocks, emphasis, etc.)

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

## Type Extraction

TypeScript types are automatically extracted from markdown code blocks and generated into `/domains/types/<domain-name>.ts` files. This process:

1. Scans all `.md` files in `/domains`
2. Extracts TypeScript code blocks (fenced with ` ```typescript`)
3. Generates importable `.ts` files in `/domains/types/`
4. Preserves all type exports and definitions

The extraction ensures types stay synchronized with documentation while keeping the markdown files readable and focused on concepts.

## Current Domains

### Books (`/domains/books.md`)

Manages physical books in the collection and their acquisition history. Tracks acquisition events (purchased, ordered, given, won, inherited) and references other domains like Locations, People, and Series.

### People (`/domains/people.md`)

Tracks individuals related to books in the collection - authors, contributors, gift-givers, and borrowers. Provides a central registry for managing relationships with books through contact information and relationship types.

### Analytics (`/domains/analytics.md`)

Observability and telemetry tracking for application behavior and performance. Records analytics events for HTTP requests, metadata lookups, user sessions, milestones, and feature usage. Uses 90-day retention policy.

## Future Domains

### Locations (`/domains/locations`)

Places where events happen - bookstores, museums, coffee shops, etc. Referenced by the Books domain and potentially others.

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
// Import from generated type files
import type { UserId, Session } from '@/domains/types/authentication'
import type { PhysicalBook, AcquisitionEvent } from '@/domains/types/books'
```

### Reading Documentation

Before working with a domain:

1. Read the domain file to understand concepts and types together
2. Check for cross-references to related domains
3. Review examples and edge cases

### Adding a New Domain

1. Create a Markdown file: `/domains/<domain-name>.md`
2. Write documentation using standard Markdown formatting
3. Define types in TypeScript code blocks immediately after their explanation
4. Export all types within the code blocks
5. Run the extraction script to generate the TypeScript file: `bun run extract-types`
6. Update this README with the new domain

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

## Benefits of Markdown-Based Domains

- Readable documentation: Markdown files are easy to read without code syntax
- Direct imports: `import type { UserId } from '@/domains/types/authentication'`
- Type checking: Generated types are validated by TypeScript compiler
- IDE support: Full autocomplete and type hints in generated `.ts` files
- Auto-generation: Types are extracted automatically from documentation
- Single source of truth: One `.md` file for both humans and machines
- Clean separation: Documentation remains readable while types remain usable

## Inspiration

- Literate programming (Donald Knuth)
- Domain-Driven Design ubiquitous language
- Textbook-style integrated diagrams and equations
- TSDoc and JSDoc conventions

## Documentation

- [How to Write Domain Documentation](../docs/how-to/write-domain-docs.md) - Complete guide
- [Domains Reference](../docs/reference/domains.md) - Index of current domains
- [Event Sourcing](../docs/explanation/event-sourcing.md) - Entities vs events

## Notes

This structure is **experimental** and will evolve as we learn what works. The goal is to maintain clarity and flexibility while building a system that grows naturally with use.
