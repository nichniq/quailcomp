# CLI Utilities

Shared utility functions for CLI output and formatting.

## Files

- [`output.ts`](output.ts) - Output formatting helpers for CLI display

## Usage

```typescript
import { formatTable, formatJson, formatError } from './utils/output'

// Format data as a table
console.log(formatTable(books, ['title', 'author', 'isbn']))

// Format data as JSON
console.log(formatJson(book))

// Format error messages
console.error(formatError('Book not found'))
```

## Purpose

Provides consistent formatting across all CLI commands for:

- Tabular data display
- JSON output
- Error messages
- Success confirmations

See [CLI Commands](../commands/) for usage examples.
