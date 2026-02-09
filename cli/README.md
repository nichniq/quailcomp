# Quailcomp CLI

Command-line interface for Quailcomp personal data management system.

## Installation

The CLI is part of the Quailcomp monorepo. From the project root:

```bash
bun install
```

## Usage

Run the CLI from the project root:

```bash
bun run cli <command> [options]
```

Or from within the cli directory:

```bash
bun run cli <command> [options]
```

### Available Commands

#### Books Management

**List all books:**

```bash
bun run cli books list
```

**Show book details:**

```bash
bun run cli books show <id>
```

**Add a new book:**

```bash
bun run cli books add --title "The Great Gatsby" --author "F. Scott Fitzgerald" --isbn13 "9780743273565"
```

Options:

- `--title <title>` - Book title (required)
- `--subtitle <subtitle>` - Book subtitle
- `--author <author>` - Book author
- `--isbn10 <isbn10>` - ISBN-10
- `--isbn13 <isbn13>` - ISBN-13
- `--lccn <lccn>` - Library of Congress Control Number
- `--note <note>` - Additional notes

**Update a book:**

```bash
bun run cli books update 123 --author "Updated Author"
```

**Delete a book (soft delete):**

```bash
bun run cli books delete 123
```

**View book history:**

```bash
bun run cli books history 123
```

#### Metadata Lookup

**Look up book metadata by ISBN:**

```bash
bun run cli metadata lookup 9780743273565
```

**Look up with specific provider:**

```bash
bun run cli metadata lookup 9780743273565 --provider google
```

Available providers:

- `all` (default) - Try all providers (composite)
- `google` - Google Books
- `openlibrary` - Open Library
- `loc` - Library of Congress
- `hardcover` - Hardcover
- `worldcat` - WorldCat Classify

**Look up by LCCN:**

```bash
bun run cli metadata lookup 2004110357
```

### Help

Get general help:

```bash
bun run cli help
```

Get command-specific help:

```bash
bun run cli help books
```

## Architecture

The CLI is built with:

- **Bun runtime** - Fast TypeScript execution
- **@quailcomp/data** - Direct access to EntitiesClient and EventsClient
- **@quailcomp/book-metadata** - Metadata lookup from external sources
- **Command pattern** - Modular command structure with subcommands

### Project Structure

```
cli/
├── src/
│   ├── commands/          # Command implementations
│   │   ├── books.ts       # Books CRUD commands
│   │   └── metadata.ts    # Metadata lookup
│   ├── utils/             # Utility functions
│   │   └── output.ts      # Output formatting
│   ├── types.ts           # TypeScript types
│   ├── router.ts          # Command routing
│   ├── context.ts         # CLI context setup
│   └── index.ts           # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Database Access

The CLI connects directly to the PostgreSQL database using the same configuration as the server. Ensure your environment variables are set:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quailcomp
DB_USER=quailcomp_app
DB_PASSWORD=your_password
```

The CLI uses the same event-sourced data model as the rest of the application:

- All operations are append-only
- Updates create new versions
- Deletes are soft deletes (marked with `deleted_at`)
- Full history is preserved and queryable

## Development

Run the CLI in development mode:

```bash
cd cli
bun run dev <command> [options]
```

Build the CLI:

```bash
cd cli
bun run build  # Builds TypeScript declarations + bundles to dist/
```

**Note**: The build process first runs `tsc --build` to generate type declarations, then bundles the CLI with Bun. TypeScript declarations are output to `dist-types/`.

Type-check without building:

```bash
bun run typecheck        # Incremental type-check
bun run typecheck:force  # Full rebuild
```

## Future Enhancements

Potential additions:

- Authentication support (login, logout, token storage)
- Interactive mode for guided workflows
- Bulk import/export (CSV, JSON)
- Events management (acquisition, lending, disposal)
- Search and filtering
- Configuration file support
- Shell completion scripts
