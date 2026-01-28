# CLI Reference

The Quailcomp CLI provides command-line access to book management and metadata lookup.

## Usage

```bash
bun run cli <command> [options]
```

## Commands

### books

Manage books in the collection.

#### books list

List all books.

```bash
bun run cli books list
```

#### books show

Show details for a specific book.

```bash
bun run cli books show <id>
```

**Arguments:**

| Name | Description |
|------|-------------|
| `id` | Entity ID of the book |

**Example:**

```bash
bun run cli books show 42
```

#### books add

Add a new book.

```bash
bun run cli books add --title <title> [options]
```

**Options:**

| Option | Description | Required |
|--------|-------------|----------|
| `--title <title>` | Book title | Yes |
| `--subtitle <subtitle>` | Book subtitle | No |
| `--author <author>` | Book author | No |
| `--isbn10 <isbn10>` | ISBN-10 | No |
| `--isbn13 <isbn13>` | ISBN-13 | No |
| `--lccn <lccn>` | Library of Congress Control Number | No |
| `--note <note>` | Additional notes | No |

**Example:**

```bash
bun run cli books add \
  --title "The Great Gatsby" \
  --author "F. Scott Fitzgerald" \
  --isbn13 "9780743273565"
```

#### books update

Update an existing book.

```bash
bun run cli books update <id> [options]
```

**Arguments:**

| Name | Description |
|------|-------------|
| `id` | Entity ID of the book |

**Options:** Same as `books add` (all optional for updates).

**Example:**

```bash
bun run cli books update 42 --note "First edition"
```

#### books delete

Soft delete a book.

```bash
bun run cli books delete <id>
```

**Arguments:**

| Name | Description |
|------|-------------|
| `id` | Entity ID of the book |

**Example:**

```bash
bun run cli books delete 42
```

#### books history

View the history of changes to a book.

```bash
bun run cli books history <id>
```

**Arguments:**

| Name | Description |
|------|-------------|
| `id` | Entity ID of the book |

**Example:**

```bash
bun run cli books history 42
```

### metadata

Look up book metadata from external providers.

#### metadata lookup

Look up book metadata by identifier.

```bash
bun run cli metadata lookup <identifier> [options]
```

**Arguments:**

| Name | Description |
|------|-------------|
| `identifier` | ISBN or LCCN to look up |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--provider <provider>` | Specific provider to use | `all` |

**Providers:**

| Value | Description |
|-------|-------------|
| `all` | Try all providers (composite) |
| `google` | Google Books |
| `openlibrary` | Open Library |
| `loc` | Library of Congress |
| `hardcover` | Hardcover |
| `worldcat` | WorldCat Classify |

**Examples:**

```bash
# Look up by ISBN (tries all providers)
bun run cli metadata lookup 9780743273565

# Look up with specific provider
bun run cli metadata lookup 9780743273565 --provider google

# Look up by LCCN
bun run cli metadata lookup 2004110357
```

### help

Get help information.

```bash
bun run cli help
bun run cli help <command>
```

**Examples:**

```bash
# General help
bun run cli help

# Command-specific help
bun run cli help books
bun run cli help metadata
```

## Database Configuration

The CLI connects directly to the database using environment variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quailcomp
DB_USER=quailcomp_app
DB_PASSWORD=your_password
```

See [Environment Variables](environment-variables.md) for full reference.

## Data Model

The CLI uses the same event-sourced data model as the rest of the application:

- All operations are append-only
- Updates create new versions
- Deletes are soft deletes (marked with `deleted_at`)
- Full history is preserved

See [Event Sourcing](../explanation/event-sourcing.md) for details.

## Project Structure

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
└── package.json
```

## Development

Run in development mode:

```bash
cd cli
bun run dev <command> [options]
```

## Related

- [API Reference](api.md) - HTTP API endpoints
- [EntitiesClient](entities-client.md) - Data access API
- [Environment Variables](environment-variables.md) - Configuration
