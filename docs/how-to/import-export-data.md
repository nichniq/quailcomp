# How to Import and Export Data

This guide covers bulk operations for importing and exporting books in Quailcomp.

## Overview

Quailcomp supports three file formats for bulk operations:

- **CSV** - Simple comma-separated values
- **JSON** - Structured JavaScript Object Notation
- **XLSX** - Microsoft Excel spreadsheets

All import/export operations require authentication and respect authorization rules (you can only import/export books you have access to).

## Importing Books

### CSV Import

CSV (Comma-Separated Values) is the simplest format for bulk book imports.

**1. Create a CSV file:**

```csv
title,author,isbn13,note
The Hobbit,J.R.R. Tolkien,9780547928241,Great fantasy classic
The Fellowship of the Ring,J.R.R. Tolkien,9780544003415,Part 1 of LOTR
The Two Towers,J.R.R. Tolkien,9780544003422,Part 2 of LOTR
```

**2. Import via API:**

```bash
curl -X POST http://localhost:3000/books/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@books.csv" \
  -F "format=csv"
```

**Supported CSV Headers:**

The CSV parser recognizes multiple variations of column names (case-insensitive):

| Data Field | Recognized Headers |
|------------|-------------------|
| Title | `title`, `Title` |
| Subtitle | `subtitle`, `Subtitle` |
| Author | `author`, `Author` |
| ISBN-13 | `isbn13`, `ISBN-13`, `ISBN`, `isbn` |
| ISBN-10 | `isbn10`, `ISBN-10` |
| Series ID | `series_id`, `seriesid`, `series`, `Series ID` |
| LCCN | `lccn`, `LCCN` |
| Notes | `note`, `notes`, `Note`, `Notes` |

**Tips for CSV:**

- Use quotes for values containing commas: `"Fantasy, Fiction"`
- Leave cells empty if no value (don't use `null` or `N/A`)
- UTF-8 encoding recommended for special characters
- First row must be headers

### JSON Import

JSON format provides more structure and supports nested data.

**1. Create a JSON file:**

```json
[
  {
    "title": "The Hobbit",
    "author": "J.R.R. Tolkien",
    "isbn13": "9780547928241",
    "publication_year": 1937,
    "publisher": "Houghton Mifflin",
    "condition": "Good",
    "note": "Great fantasy classic"
  },
  {
    "title": "The Fellowship of the Ring",
    "subtitle": "The Lord of the Rings, Part 1",
    "author": "J.R.R. Tolkien",
    "isbn13": "9780544003415",
    "publication_year": 1954,
    "condition": "Excellent",
    "note": "Part 1 of LOTR"
  }
]
```

**2. Import via API:**

```bash
curl -X POST http://localhost:3000/books/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@books.json" \
  -F "format=json"
```

**Supported JSON Fields:**

All fields from the Books domain are supported:

- `title` (required)
- `subtitle`
- `author`
- `isbn10`, `isbn13`
- `lccn`
- `publication_year`
- `publisher`
- `condition`
- `series_id`
- `volume_number`
- `note`
- `acquisition` (object with type, date, etc.)

**Tips for JSON:**

- Must be valid JSON (use a validator if unsure)
- Root element must be an array
- All string values must be quoted
- Numbers and booleans are not quoted

### XLSX Import

XLSX (Excel) format is useful for preparing imports in spreadsheet applications.

**1. Create an Excel file:**

Create a spreadsheet with these columns:

- Column A: title
- Column B: author
- Column C: isbn13
- Column D: note

Fill in your book data starting from row 2 (row 1 is headers).

**2. Save as .xlsx format** (not .xls or .csv)

**3. Import via API:**

```bash
curl -X POST http://localhost:3000/books/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@books.xlsx" \
  -F "format=xlsx"
```

**Tips for XLSX:**

- Use the same column names as CSV format
- First row must be headers
- No merged cells in data rows
- Keep data simple (avoid formulas in cells)

### Import Response

Successful import returns details about imported books:

```json
{
  "imported": [
    {
      "entityId": 1,
      "data": {
        "title": "The Hobbit",
        "author": "J.R.R. Tolkien",
        "isbn13": "9780547928241",
        "note": "Great fantasy classic"
      }
    },
    {
      "entityId": 2,
      "data": {
        "title": "The Fellowship of the Ring",
        "author": "J.R.R. Tolkien",
        "isbn13": "9780544003415",
        "note": "Part 1 of LOTR"
      }
    }
  ],
  "count": 2,
  "total": 2
}
```

### Import Errors

If import fails, you'll get an error response:

```json
{
  "error": "Failed to parse file: Invalid CSV format",
  "code": "PARSE_ERROR"
}
```

**Common Issues:**

- **Invalid CSV**: Check for unquoted commas, incorrect headers
- **Invalid JSON**: Validate JSON syntax (missing quotes, trailing commas)
- **Invalid XLSX**: Ensure file is .xlsx format, not .xls or .csv
- **Missing required fields**: `title` is required for all books
- **File too large**: Consider splitting into smaller batches

### Authorization on Import

- All imported books are automatically owned by you (owner access granted)
- You can immediately read, write, and manage the imported books
- To share imported books, use the authorization endpoints to grant access to other users

## Exporting Books

Export your book collection in any supported format.

### Export to JSON (Default)

```bash
curl http://localhost:3000/books/export \
  -H "Authorization: Bearer $TOKEN" \
  > my-books.json
```

**Output:**

```json
[
  {
    "entity_id": 1,
    "title": "The Hobbit",
    "author": "J.R.R. Tolkien",
    "isbn13": "9780547928241",
    "note": "Great fantasy classic"
  },
  {
    "entity_id": 2,
    "title": "The Fellowship of the Ring",
    "subtitle": "The Lord of the Rings, Part 1",
    "author": "J.R.R. Tolkien",
    "isbn13": "9780544003415",
    "note": "Part 1 of LOTR"
  }
]
```

### Export to CSV

```bash
curl "http://localhost:3000/books/export?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  > my-books.csv
```

**Output:**

```csv
entity_id,title,subtitle,author,series_id,isbn10,isbn13,lccn,note
1,The Hobbit,,J.R.R. Tolkien,,0547928246,9780547928241,,Great fantasy classic
2,The Fellowship of the Ring,The Lord of the Rings Part 1,J.R.R. Tolkien,,,9780544003415,,Part 1 of LOTR
```

### Export to XLSX

```bash
curl "http://localhost:3000/books/export?format=xlsx" \
  -H "Authorization: Bearer $TOKEN" \
  > my-books.xlsx
```

Opens in Excel or LibreOffice Calc.

### Export with Browser

For browser-based export:

```javascript
async function exportBooks(format = 'json') {
  const response = await fetch(`/books/export?format=${format}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `books-${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Usage
exportBooks('csv');  // Download CSV
exportBooks('json'); // Download JSON
exportBooks('xlsx'); // Download XLSX
```

### Authorization on Export

- Only books you have read access to are included in exports
- Export respects authorization rules (filtered to accessible books)
- Shared books appear if you have at least read access

## Batch Updates

Update multiple books in a single request.

### Basic Batch Update

```bash
curl -X PUT http://localhost:3000/books/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "entity_id": 1,
        "data": {
          "condition": "Excellent",
          "note": "Re-read and loved it"
        }
      },
      {
        "entity_id": 2,
        "data": {
          "condition": "Good",
          "note": "Classic fantasy"
        }
      }
    ]
  }'
```

### Batch Update Response

```json
{
  "results": [
    {
      "entity_id": 1,
      "success": true,
      "data": {
        "entityId": 1,
        "data": {
          "title": "The Hobbit",
          "condition": "Excellent",
          "note": "Re-read and loved it"
        }
      }
    },
    {
      "entity_id": 2,
      "success": true,
      "data": {
        "entityId": 2,
        "data": {
          "title": "The Fellowship of the Ring",
          "condition": "Good",
          "note": "Classic fantasy"
        }
      }
    }
  ],
  "success": 2,
  "failed": 0
}
```

### Partial Failures

Some updates may fail due to permissions or missing books:

```json
{
  "results": [
    {
      "entity_id": 1,
      "success": true,
      "data": { ... }
    },
    {
      "entity_id": 999,
      "error": "Not found"
    },
    {
      "entity_id": 3,
      "error": "Forbidden - no write access"
    }
  ],
  "success": 1,
  "failed": 2
}
```

**Important Notes:**

- Each update is checked independently for authorization
- Failed updates don't prevent successful ones
- Updates are not transactional (no rollback on partial failure)
- Only provided fields are updated (partial update semantics)

### Common Batch Update Patterns

**Update condition for all books:**

```javascript
// Get all book IDs
const books = await fetch('/books', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Create batch update
const updates = books.books.map(book => ({
  entity_id: book.entity_id,
  data: { condition: 'Good' }
}));

// Apply updates
await fetch('/books/batch', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ updates })
});
```

**Add notes to multiple books:**

```bash
curl -X PUT http://localhost:3000/books/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"entity_id": 1, "data": {"note": "Birthday gift 2024"}},
      {"entity_id": 2, "data": {"note": "Birthday gift 2024"}},
      {"entity_id": 3, "data": {"note": "Birthday gift 2024"}}
    ]
  }'
```

## Best Practices

### Import Best Practices

1. **Start Small** - Test with 5-10 books before importing hundreds
2. **Validate Data** - Check your CSV/JSON/XLSX for errors before importing
3. **Use Unique Identifiers** - ISBN-13 helps avoid duplicates
4. **Backup First** - Export existing data before large imports
5. **Check Authorization** - Verify you'll own the imported books

### Export Best Practices

1. **Regular Backups** - Export your collection periodically
2. **Use JSON for Backups** - Most complete data representation
3. **Use CSV for Sharing** - Most compatible with other tools
4. **Include Metadata** - Export includes all book fields automatically
5. **Secure Exports** - Exported files contain your data, store securely

### Batch Update Best Practices

1. **Test First** - Try with 1-2 books before batch updating many
2. **Check Responses** - Verify all updates succeeded
3. **Handle Failures** - Implement retry logic for failed updates
4. **Respect Authorization** - Some books may be read-only
5. **Keep Updates Small** - Batch size of 50-100 recommended

## Troubleshooting

### Import Issues

**"Parse Error" with CSV:**

- Check for unquoted commas in values
- Ensure first row contains headers
- Verify file encoding is UTF-8

**"Parse Error" with JSON:**

- Validate JSON syntax online
- Check for trailing commas
- Ensure array brackets are present

**"Validation Error":**

- Verify `title` is present for all books
- Check field names match expected format
- Remove any invalid fields

### Export Issues

**Empty export:**

- Verify you have books in your collection
- Check authorization (you need read access)
- Try with authentication token

**Download fails:**

- Check network connection
- Verify authentication token is valid
- Try different format (JSON more reliable than XLSX)

### Batch Update Issues

**Some updates fail:**

- Check authorization (need write access)
- Verify entity IDs exist
- Review error messages in response

**All updates fail:**

- Verify authentication token
- Check request format (must be JSON)
- Ensure `updates` array is present

## Related Documentation

- [API Reference](../reference/api.md) - Complete API endpoint documentation
- [Books Domain](../../domains/books.md) - Book entity structure and fields
- [Authorization](../../domains/authorization.md) - Understanding access control
- [Development Setup](setup-development.md) - Running the server locally

## Examples

### Complete Import/Export Workflow

1. **Export existing books to backup:**

   ```bash
   curl http://localhost:3000/books/export \
     -H "Authorization: Bearer $TOKEN" \
     > backup-$(date +%Y%m%d).json
   ```

2. **Edit exported JSON to add books:**

   ```bash
   # Open in text editor, add new books to array
   code backup-20260201.json
   ```

3. **Import modified data:**

   ```bash
   curl -X POST http://localhost:3000/books/import \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@backup-20260201.json" \
     -F "format=json"
   ```

### Migrating from Another System

1. **Export from old system** to CSV
2. **Map columns** to Quailcomp format
3. **Import to Quailcomp:**

   ```bash
   curl -X POST http://localhost:3000/books/import \
     -H "Authorization: Bearer $TOKEN" \
     -F "file=@old-system-export.csv" \
     -F "format=csv"
   ```

4. **Verify import:**

   ```bash
   curl http://localhost:3000/books \
     -H "Authorization: Bearer $TOKEN" | jq '.books | length'
   ```
