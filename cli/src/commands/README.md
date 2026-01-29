# CLI Commands

Command implementations for the Quailcomp CLI.

## Files

- [`books.ts`](books.ts) - Book management commands (create, read, update, delete, list)
- [`metadata.ts`](metadata.ts) - Book metadata lookup from external providers

## Usage

Commands are invoked through the CLI router:

```bash
# Book commands
quailcomp books add --title "Example" --author "John Doe"
quailcomp books list
quailcomp books get <id>
quailcomp books update <id> --title "New Title"
quailcomp books delete <id>

# Metadata commands
quailcomp metadata lookup --isbn 9780134685991
quailcomp metadata search --title "Domain Driven Design"
```

## Structure

Each command file exports handler functions that:

1. Parse and validate command arguments
2. Execute business logic (database operations, API calls)
3. Format and display output using utilities from [`../utils/`](../utils/)

## Documentation

- [CLI Reference](../../../docs/reference/cli.md)
- [CLI README](../../README.md)
