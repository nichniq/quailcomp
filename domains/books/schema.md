# Book Collection Domain

## Bounded Context

**Book Collection** - Manages physical books I own and tracks their lifecycle events, primarily acquisition history.

## Purpose

This domain captures the provenance and story of each physical book in my collection. It answers questions like:
- What books do I own?
- When and where did I acquire each book?
- Who gave me this book?
- How much did I pay for it?

The system helps prevent buying duplicates and preserves the acquisition stories that give context to the collection.

## Ubiquitous Language

### Core Entities

**Physical Book** (aggregate root)
- A specific physical edition that I own
- Each book is uniquely identified by an entity_id in my system
- May have external identifiers (ISBN, LCCN) but these are optional attributes
- Two different editions of the same work are two different Physical Books

### Domain Events

**Acquired** - The event when a book enters my collection
- Every book that I tracked the acquisition for has exactly one Acquired event
- Historical books may not have an Acquired event (information not recorded)
- Acquired is a sum type with variants based on how the book was obtained

### Acquisition Variants (Algebraic Data Type)

**Purchased** - Bought from a physical store
- Always has: location_id (reference to Locations domain), cost, date
- Optional: notes about circumstances

**Ordered** - Bought online or via mail order
- Always has: cost, date
- Optional: notes about circumstances

**Given** - Received as a gift
- Always has: person_id (reference to Contacts domain), date
- Optional: notes about circumstances and context

**Won** - Obtained through winning (contests, bingo, etc.)
- Always has: date
- Optional: notes about how/where won

**Inherited** - Received from family, estate, or previous ownership
- Optional: date (may not know when inherited)
- Optional: notes about provenance

### Value Objects / Attributes

**Edition Identifiers** (all optional)
- isbn10 - 10-digit ISBN
- isbn13 - 13-digit ISBN  
- lccn - Library of Congress Control Number

**Bibliographic Information** (all optional)
- title - Book title (almost always present, but not strictly required)
- subtitle - Subtitle if present
- author - Author name(s)
- note - Personal notes, special information, or context

### References to Other Bounded Contexts

**Location** (from Locations domain)
- Referenced by location_id in Purchased acquisitions
- Stores information about bookstores, museums, coffee shops, etc.

**Person** (from Contacts domain)
- Referenced by person_id in Given acquisitions
- Stores information about friends, family, and relationships

**Series** (from Series domain)
- Referenced by series_id on books that belong to a series
- Stores information about book series (e.g., "What Life Was Like", "Golden Guide")

## Domain Model

```
Physical Book (Aggregate Root)
├─ entity_id: unique identifier
├─ title: string (optional but usually present)
├─ subtitle?: string
├─ author?: string
├─ series_id?: reference to Series
├─ isbn10?: string
├─ isbn13?: string
├─ lccn?: string
├─ note?: string
└─ Events:
   └─ Acquired (zero or one)
      ├─ Purchased { location_id, cost, date, notes? }
      ├─ Ordered { cost, date, notes? }
      ├─ Given { person_id, date, notes? }
      ├─ Won { date, notes? }
      └─ Inherited { date?, notes? }
```

## Invariants

**Hard Invariants** (enforced by system):
1. Every book has a unique entity_id
2. (Future) A book cannot be Lent if currently lent out
3. (Future) A book cannot have events after Disposed

**Soft Expectations** (usually true, not enforced):
- Books usually have titles
- Books usually have acquisition information
- Books usually have some form of identification (ISBN or LCCN)

The system acknowledges that real-world data is messy - some books were acquired before tracking began, some publications lack standard identifiers, and some information may be lost or never recorded.

## Future Events (Not Yet Implemented)

**Lent** - Book checked out to someone
- person_id, date

**Returned** - Book came back from being lent
- date

**Disposed** - Book permanently left collection (terminal state)
- reason (destroyed, given away, sold, lost, etc.)
- date

## Display and Presentation

When displaying books with identical titles, distinguish them using:
1. Subtitle (if present)
2. Author (if present)
3. ISBN (as last resort for technical contexts)

Example:
- "Water: A Journey Through the Element"
- "Water: Exploring the Blue Planet"

## Context Map

**Book Collection** → **Locations** (Customer/Supplier)
- Book Collection consumes Location data
- Stores location_id in Purchased acquisition events
- Looks up Location details for display

**Book Collection** → **Contacts** (Customer/Supplier)
- Book Collection consumes Person data
- Stores person_id in Given acquisition events
- Looks up Person details for display

**Book Collection** → **Series** (Customer/Supplier)
- Book Collection references Series data
- Stores series_id as optional book attribute
- Looks up Series details for display

## Queries and Use Cases

**Primary Use Cases:**
1. Check if I already own a book (avoid duplicates)
2. View acquisition history and stories
3. Track spending on books
4. Browse collection by various attributes

**Key Queries:**
- Find book by title
- List all books
- List books by series
- List books acquired from specific location
- List books given by specific person
- List books without acquisition information
- Calculate total spending on books

## Notes

This is a living document that will evolve as the domain grows. Future additions may include lending/borrowing workflows, book condition tracking, physical organization (shelf location), and research features (quotes, citations, notes).
