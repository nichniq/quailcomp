# Server Utilities

Shared utility functions for the Quailcomp server.

## Files

### Import/Export Utilities

- **`import-parsers.ts`** - Parse book data from various file formats
  - `parseCSV(content)` - Parse CSV files with header row
  - `parseJSON(content)` - Parse JSON arrays of books
  - `parseXLSX(buffer)` - Parse Excel (.xlsx) files
  - Supports flexible column naming (e.g., "ISBN-13", "isbn13", "ISBN")
  - Handles quoted values, escaped quotes, and commas in CSV

- **`export-formatters.ts`** - Export book data to various file formats
  - `exportCSV(books)` - Generate CSV with proper escaping
  - `exportJSON(books)` - Generate formatted JSON
  - `exportXLSX(books)` - Generate Excel (.xlsx) files
  - Includes entity IDs in exports for re-import tracking

## Usage Examples

### Import CSV

```typescript
import { parseCSV } from "@/utils/import-parsers";

const csv = `title,author,isbn13
The Hobbit,J.R.R. Tolkien,9780547928241`;

const books = parseCSV(csv);
// [{ title: "The Hobbit", author: "J.R.R. Tolkien", isbn13: "9780547928241" }]
```

### Export to JSON

```typescript
import { exportJSON } from "@/utils/export-formatters";

const books = [
  { entityId: 1, data: { title: "The Hobbit", author: "J.R.R. Tolkien" } }
];

const json = exportJSON(books);
// Pretty-printed JSON string with entity_id included
```

### Import XLSX

```typescript
import { parseXLSX } from "@/utils/import-parsers";

const buffer = await file.arrayBuffer();
const books = await parseXLSX(buffer);
// Array of BookEntitySnapshot objects
```

## Column Name Mapping

Import parsers recognize multiple variations of column names:

| Field | Recognized Names |
|-------|-----------------|
| `title` | title, Title |
| `author` | author, Author |
| `isbn13` | isbn13, ISBN-13, ISBN, isbn |
| `isbn10` | isbn10, ISBN-10 |
| `series_id` | series_id, seriesid, series, Series ID |
| `lccn` | lccn, LCCN |
| `note` | note, notes, Note, Notes |

All matching is case-insensitive after trimming whitespace.

## Dependencies

- **`xlsx`** - Required for XLSX import/export (installed via `bun add xlsx`)

## Testing

See `server/tests/bulk-operations.test.ts` for comprehensive test coverage.
