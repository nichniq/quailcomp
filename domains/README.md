# Domains Directory

This directory contains the domain models for the personal data management system. Each subdirectory represents a **bounded context** in Domain-Driven Design terms.

## Purpose

The `/domains` directory serves as:
1. **Living documentation** of each domain's concepts and rules
2. **Type definitions** used throughout the application
3. **Single source of truth** for domain logic and structure

## Structure

Each domain follows this structure:

```
/domains
  /{domain-name}
    schema.md       # Human-readable domain documentation
    types.ts        # TypeScript types (domain + persistence)
    queries.ts      # (Optional) Domain-specific query helpers
    README.md       # (Optional) Additional context
```

### `schema.md`

Documents the domain using Domain-Driven Design concepts:
- **Bounded Context** - What this domain is responsible for
- **Ubiquitous Language** - Key terms and their precise meanings
- **Domain Model** - Entities, events, value objects, and their relationships
- **Invariants** - Rules that must always be true
- **Context Map** - How this domain relates to others

This file should be readable by non-developers and serve as the authoritative reference for how we think about this domain.

### `types.ts`

Contains TypeScript type definitions:

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

The `data` module imports these types to ensure type safety between domain logic and database operations.

## Current Domains

### Books (`/domains/books`)
Manages physical books in the collection and their acquisition history. This is the first domain implemented and serves as the template for future domains.

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
// Import domain types
import { PhysicalBook, AcquisitionEvent } from '@/domains/books/types'
import { Location } from '@/domains/locations/types'

// Import persistence types
import { BookEntityRow, BookEntitySnapshot } from '@/domains/books/types'
```

### Reading Documentation

Before working with a domain:
1. Read its `schema.md` to understand the concepts
2. Review the `types.ts` to see the technical implementation
3. Check the Context Map section to understand dependencies

### Adding a New Domain

1. Create a new directory: `/domains/{domain-name}`
2. Write `schema.md` following the Book Collection template
3. Define types in `types.ts` (domain + persistence)
4. Update this README with the new domain

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

## Notes

This structure is **experimental** and will evolve as we learn what works. The goal is to maintain clarity and flexibility while building a system that grows naturally with use.
