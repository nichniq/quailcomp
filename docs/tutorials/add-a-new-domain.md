# Tutorial: Add a New Domain

In this tutorial, you'll create a new domain from scratch: **Locations**. By the end, you'll have:

- A documented domain with TypeScript types
- Auto-generated type files
- Working code that uses the domain

This tutorial assumes you've completed [Development Setup](../how-to/setup-development.md).

## What You'll Learn

- How domains work in Quailcomp
- Writing documentation with embedded types
- How type extraction works
- Connecting domains to the data layer

## Step 1: Understand What a Domain Is

A domain is a bounded context - a self-contained area of the system with its own concepts, rules, and types. In Quailcomp:

- **Books** tracks physical books and acquisitions
- **Authentication** handles user identity
- **Authorization** manages permissions

**Locations** will track places where things happen - bookstores, coffee shops, museums. Other domains (like Books) can reference locations by ID.

## Step 2: Create the Domain File

Create a new file at `domains/locations.md`:

```bash
touch domains/locations.md
```

Open it and add the header:

```markdown
# Locations

> Places where events happen - bookstores, museums, coffee shops.

Locations represent physical places that are meaningful to your personal data.
A location might be where you bought a book, visited on a trip, or regularly
spend time. Locations are referenced by other domains through their ID.
```

## Step 3: Define the Core Type

Think about what makes up a location. Add this to your file:

```markdown
## Location

> A physical place with an address or coordinates.

Locations can be as specific as "Powell's Books on Burnside" or as general as
"Portland, Oregon". The level of detail depends on what's useful for your
records.

```typescript
export type Location = {
  entity_id: number;
  name: string;
  type?: LocationType;
  address?: Address;
  coordinates?: Coordinates;
  notes?: string;
};
```

```

Notice how we explain the concept first, then define the type.

## Step 4: Add Supporting Types

Locations need a few supporting types. Continue adding to your file:

```markdown
### Location Types

> Categories help organize and filter locations.

```typescript
export type LocationType =
  | 'bookstore'
  | 'library'
  | 'coffee_shop'
  | 'restaurant'
  | 'museum'
  | 'park'
  | 'home'
  | 'office'
  | 'other';
```

### Address

> Street address for physical locations.

Not all locations need a full address - a park might just have a name and
coordinates. All fields are optional to accommodate different levels of detail.

```typescript
export type Address = {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};
```

### Coordinates

> GPS coordinates for mapping and distance calculations.

```typescript
export type Coordinates = {
  latitude: number;
  longitude: number;
};
```

```

## Step 5: Add a Location Event

Locations are entities (nouns), but we might also want to record visits (verbs). Add:

```markdown
## Visit Event

> Records when you visited a location.

Visits are events - immutable facts about something that happened. A visit
can be enriched later with notes, photos, or links to other entities (like
books you bought there).

```typescript
export type VisitEvent = {
  event_id: number;
  location_id: number;
  visited_at: Date;
  duration_minutes?: number;
  purpose?: string;
  notes?: string;
};
```

```

## Step 6: Extract the Types

Run the type extraction script:

```bash
bun run domains/scripts/extract-types.ts
```

Check that it created `domains/types/locations.ts`:

```bash
cat domains/types/locations.ts
```

You should see all your exported types in a clean TypeScript file.

## Step 7: Use the Types

Now you can import and use your types. Create a quick test file:

```typescript
// test-locations.ts (temporary - delete after testing)
import type { Location, LocationType, VisitEvent } from './domains/types/locations'

const powells: Location = {
  entity_id: 1,
  name: "Powell's City of Books",
  type: 'bookstore',
  address: {
    street: '1005 W Burnside St',
    city: 'Portland',
    state: 'OR',
    postalCode: '97209',
    country: 'USA'
  },
  notes: 'The largest independent bookstore in the world'
}

const visit: VisitEvent = {
  event_id: 1,
  location_id: powells.entity_id,
  visited_at: new Date('2024-01-15'),
  purpose: 'Book shopping',
  notes: 'Found a first edition!'
}

console.log(`Visited ${powells.name} on ${visit.visited_at}`)
```

Run it to verify the types work:

```bash
bun run test-locations.ts
```

Then delete the test file.

## Step 8: Connect to the Data Layer

To actually persist locations, use the EntitiesClient:

```typescript
import { EntitiesClient, EventsClient, getConnection } from '@quailcomp/data'
import type { Location, VisitEvent } from './domains/types/locations'

const sql = getConnection()
const entities = new EntitiesClient(sql)
const events = new EventsClient(sql)

// Create a location entity
const location = await entities.create<Location>({
  type: 'location',
  data: {
    name: "Powell's City of Books",
    type: 'bookstore',
    address: {
      city: 'Portland',
      state: 'OR'
    }
  }
})

// Record a visit event
await events.record<VisitEvent>({
  eventType: 'location_visited',
  occurredAt: new Date('2024-01-15'),
  data: {
    location_id: location.entity_id,
    purpose: 'Book shopping'
  }
})

// Later: enrich the visit with notes
await events.enrich<VisitEvent>({
  eventId: visitEvent.event_id,
  eventType: 'location_visited',
  occurredAt: visitEvent.occurred_at,
  data: {
    ...visitEvent.data,
    notes: 'Found a first edition of The Great Gatsby!'
  }
})
```

## Step 9: Update the Domains Index

Update `domains/README.md` to include your new domain in the "Current Domains" section:

```markdown
### Locations (`/domains/locations.md`)

Physical places where events happen - bookstores, museums, coffee shops.
Referenced by Books and other domains for acquisition locations, visit
tracking, etc.
```

Also update `docs/reference/domains.md` to list the new domain.

## Step 10: Reference from Other Domains

Now other domains can reference locations. For example, in `domains/books.md`, you might update the acquisition event:

```typescript
export type AcquisitionEvent = {
  event_id: number;
  book_id: number;
  method: AcquisitionMethod;
  occurred_at: Date;
  location_id?: number;  // References Locations domain
  // ...
};
```

## Your Complete Domain File

Here's what `domains/locations.md` should look like:

```markdown
# Locations

> Places where events happen - bookstores, museums, coffee shops.

Locations represent physical places that are meaningful to your personal data.
A location might be where you bought a book, visited on a trip, or regularly
spend time. Locations are referenced by other domains through their ID.

## Location

> A physical place with an address or coordinates.

Locations can be as specific as "Powell's City of Books on Burnside" or as
general as "Portland, Oregon". The level of detail depends on what's useful
for your records.

```typescript
export type Location = {
  entity_id: number;
  name: string;
  type?: LocationType;
  address?: Address;
  coordinates?: Coordinates;
  notes?: string;
};
```

### Location Types

> Categories help organize and filter locations.

```typescript
export type LocationType =
  | 'bookstore'
  | 'library'
  | 'coffee_shop'
  | 'restaurant'
  | 'museum'
  | 'park'
  | 'home'
  | 'office'
  | 'other';
```

### Address

> Street address for physical locations.

Not all locations need a full address - a park might just have a name and
coordinates. All fields are optional to accommodate different levels of detail.

```typescript
export type Address = {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};
```

### Coordinates

> GPS coordinates for mapping and distance calculations.

```typescript
export type Coordinates = {
  latitude: number;
  longitude: number;
};
```

## Visit Event

> Records when you visited a location.

Visits are events - immutable facts about something that happened. A visit
can be enriched later with notes, photos, or links to other entities (like
books you bought there).

```typescript
export type VisitEvent = {
  event_id: number;
  location_id: number;
  visited_at: Date;
  duration_minutes?: number;
  purpose?: string;
  notes?: string;
};
```

```

## What You Learned

- Domains are documented in Markdown with embedded TypeScript
- Types are extracted automatically to `/domains/types/`
- Domains reference each other by ID (loose coupling)
- Entities are nouns (things), events are verbs (what happened)
- The pre-commit hook auto-extracts types when you commit

## Next Steps

- Read [Why Event Sourcing?](../explanation/event-sourcing.md) to understand entities vs events
- See [How to Write Domain Documentation](../how-to/write-domain-docs.md) for style guidelines
- Explore existing domains in `/domains/` for more examples
