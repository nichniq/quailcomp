# Domain Types

Auto-generated TypeScript types extracted from domain documentation.

## Generated Files

- [`analytics.ts`](analytics.ts) - Types extracted from [analytics.md](../analytics.md)
- [`authentication.ts`](authentication.ts) - Types extracted from [authentication.md](../authentication.md)
- [`authorization.ts`](authorization.ts) - Types extracted from [authorization.md](../authorization.md)
- [`book-metadata-services.ts`](book-metadata-services.ts) - Types extracted from [book-metadata-services.md](../book-metadata-services.md)
- [`books.ts`](books.ts) - Types extracted from [books.md](../books.md)
- [`configuration.ts`](configuration.ts) - Types extracted from [configuration.md](../configuration.md)
- [`database.ts`](database.ts) - Types extracted from [database.md](../database.md)
- [`devtools.ts`](devtools.ts) - Types extracted from [devtools.md](../devtools.md)
- [`entities.ts`](entities.ts) - Types extracted from [entities.md](../entities.md)
- [`errors.ts`](errors.ts) - Types extracted from [errors.md](../errors.md)
- [`events.ts`](events.ts) - Types extracted from [events.md](../events.md)
- [`http.ts`](http.ts) - Types extracted from [http.md](../http.md)
- [`logging.ts`](logging.ts) - Types extracted from [logging.md](../logging.md)
- [`metrics.ts`](metrics.ts) - Types extracted from [metrics.md](../metrics.md)
- [`people.ts`](people.ts) - Types extracted from [people.md](../people.md)
- [`series.ts`](series.ts) - Types extracted from [series.md](../series.md)
- [`websocket.ts`](websocket.ts) - Types extracted from [websocket.md](../websocket.md)

## Purpose

These types are automatically extracted from domain Markdown files by the pre-commit hook. This ensures:

1. Domain documentation is the single source of truth
2. Types stay in sync with documentation
3. Types can be imported across the codebase

## Usage

```typescript
import { User, Credentials } from '@quailcomp/domains/types/authentication'
import { Permission, Role } from '@quailcomp/domains/types/authorization'
import { Book, ISBN } from '@quailcomp/domains/types/books'
```

## Generation

Types are extracted by [`types-from-docs.ts`](../../devtools/watch/tasks/types-from-docs.ts).

**Automatic generation** (during development):

```bash
# Run devtools watcher (regenerates on markdown changes)
bun run devtools
```

**Manual extraction** (if needed):

```bash
bun run devtools/watch/tasks/types-from-docs.ts
```

**Pre-commit hook** also verifies types are up to date.

## Extraction Rules

Only TypeScript code blocks with `export` statements are extracted:

- ✅ Exported types, interfaces, classes, enums
- ✅ Import statements needed by exported declarations
- ❌ Example code without exports
- ❌ Function declarations without implementations

## Do Not Edit

**⚠️ These files are auto-generated. Do not edit them directly.**

To make changes:

1. Edit the source domain Markdown file (e.g., [domains/authentication.md](../authentication.md))
2. Types will regenerate automatically if devtools is running
3. Or run `bun run devtools/watch/tasks/types-from-docs.ts` manually

See [Write Domain Documentation](../../docs/how-to/write-domain-docs.md) for guidelines.
