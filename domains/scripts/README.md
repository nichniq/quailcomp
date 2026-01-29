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
3. Extracts type definitions, interfaces, and enums
4. Generates corresponding `.ts` files in [`types/`](../types/)
5. Preserves imports and exports

### Example

Given this in `authentication.md`:

````markdown
```typescript
export type User = {
  id: string
  email: string
}
```
````

Generates `types/authentication.ts`:

```typescript
export type User = {
  id: string
  email: string
}
```

## Documentation

- [Write Domain Documentation](../../docs/how-to/write-domain-docs.md)
- [Add a New Domain](../../docs/tutorials/add-a-new-domain.md)
