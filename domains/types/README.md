# Domain Types

Auto-generated TypeScript types extracted from domain documentation.

## Generated Files

- [`authentication.ts`](authentication.ts) - Types extracted from [authentication.md](../authentication.md)
- [`authorization.ts`](authorization.ts) - Types extracted from [authorization.md](../authorization.md)
- [`books.ts`](books.ts) - Types extracted from [books.md](../books.md)

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

Types are extracted by [`extract-types.ts`](../scripts/extract-types.ts) and run automatically via git hooks:

```bash
# Manual extraction
bun run domains/scripts/extract-types.ts

# Automatic via git hooks (on commit)
git commit -m "Update domain docs"
```

## Do Not Edit

These files are generated. Edit the source domain Markdown files instead:

- [domains/authentication.md](../authentication.md)
- [domains/authorization.md](../authorization.md)
- [domains/books.md](../books.md)

See [Write Domain Documentation](../../docs/how-to/write-domain-docs.md) for guidelines.
