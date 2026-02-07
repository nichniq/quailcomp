# Domain Scripts

Utilities for domain documentation processing.

## Files

- [`extract-types.ts`](extract-types.ts) - Extracts TypeScript types from domain Markdown files

## Extract Types

Parses domain Markdown files and generates TypeScript type definition files in [`types/`](../types/).

### Usage

```bash
# Manual extraction
bun run domains/scripts/extract-types.ts

# Automatic via git pre-commit hook
git commit -m "Update domains"
```

### How It Works

1. Reads all `.md` files in [`domains/`](../)
2. Finds TypeScript code blocks (```typescript)
3. Filters to only include exported statements and their dependencies
4. Skips code blocks containing only example/usage code
5. Generates corresponding `.ts` files in [`types/`](../types/)

### Example

Given this in `authentication.md`:

````markdown
Type definition:
```typescript
export type User = {
  id: string
  email: string
}
```

Usage example:
```typescript
const user: User = {
  id: '123',
  email: 'user@example.com',
}
```
````

Generates `types/authentication.ts` with **only the exported type**:

```typescript
export type User = {
  id: string
  email: string
}
```

The usage example is filtered out since it contains no exports.

## Documentation

- [Write Domain Documentation](../../docs/how-to/write-domain-docs.md)
- [Add a New Domain](../../docs/tutorials/add-a-new-domain.md)
