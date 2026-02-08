# Series

> Tracks book series (trilogies, multi-volume works, sagas) and their ordering.

Series provide a way to group related books together and maintain their reading order. A series can have multiple books, and each book in a series can have a volume number and optional volume name.

## Series Entity

> A named collection of related books with optional volume tracking.

```typescript
export type Series = {
  entity_id: string
  name: string
  total_volumes?: number
  notes?: string
}

export type SeriesEntitySnapshot = {
  name: string
  total_volumes?: number
  notes?: string
}

export type SeriesEntityRow = {
  entity_id: number
  entity_type: 'series'
  data: SeriesEntitySnapshot
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}
```

## Query Result Types

```typescript
import type { PhysicalBook } from "./books";

export type SeriesListItem = {
  entity_id: string
  name: string
  total_volumes?: number
  book_count?: number
}

export type BookInSeries = {
  book_id: string
  series_id: string
  volume_number?: number
  volume_name?: string
}

export type SeriesWithBooks = {
  series: Series
  books: Array<{
    book: PhysicalBook
    volume_number?: number
    volume_name?: string
  }>
}
```

## Invariants

- **Unique names**: Series names should be unique (enforced at application level)
- **Volume ordering**: If volume_number is specified, it must be positive
- **Total volumes consistency**: If specified, total_volumes should match or exceed the number of books
- **Soft deletion**: Deleted series are marked with deleted_at, not removed

## Use Cases

### Primary Use Cases

1. **Track book series**: Group related books (trilogies, sagas, multi-volume works)
2. **Maintain reading order**: Use volume numbers to specify correct reading sequence
3. **Collection management**: See which books in a series you own vs. missing
4. **Series discovery**: Find all books belonging to a specific series

### Example Queries

**List all series with book counts:**

```sql
SELECT
  s.entity_id,
  s.data->>'name' as name,
  s.data->>'total_volumes' as total_volumes,
  COUNT(b.entity_id) as book_count
FROM entities s
LEFT JOIN entities b ON
  b.type = 'book'
  AND b.data->>'series_id' = s.entity_id::text
  AND b.deleted_at IS NULL
WHERE s.type = 'series' AND s.deleted_at IS NULL
GROUP BY s.entity_id;
```

**Find incomplete series:**

```sql
SELECT
  entity_id,
  data->>'name' as name,
  (data->>'total_volumes')::int as total_volumes,
  COUNT(*) as owned_books
FROM entities s
LEFT JOIN entities b ON
  b.type = 'book'
  AND b.data->>'series_id' = s.entity_id::text
WHERE s.type = 'series'
  AND s.deleted_at IS NULL
  AND s.data->>'total_volumes' IS NOT NULL
GROUP BY s.entity_id
HAVING COUNT(b.entity_id) < (s.data->>'total_volumes')::int;
```

## Integration with Books Domain

Books reference series through the `series_id` field in their data. In the PhysicalBook type, these fields are included:

- `series_id?: string` - References Series.entity_id
- `volume_number?: number` - Position in series
- `volume_name?: string` - Optional volume subtitle

## Notes

- Series entities use the standard entities table with `type='series'`
- Book-to-series relationship is stored in the book's JSONB data
- No separate join table needed for simple series tracking
- If complex volume ordering becomes important, consider a `series_books` join table
