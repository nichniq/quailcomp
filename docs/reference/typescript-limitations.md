# TypeScript Configuration

## Project References (Implemented)

The monorepo uses [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html) to handle cross-package type-checking with proper module boundaries and path resolution.

### Architecture

**Shared Base Configuration:**
- `tsconfig.base.json` - Common compiler options for all packages

**Composite Packages:**
All workspace packages use `composite: true` mode:
- `domains/` - Domain type definitions
- `data/client/` - Data layer (@quailcomp/data)
- `services/book-metadata/` - Book metadata service
- `server/` - Backend server
- `cli/` - CLI tool
- `frontend/` - Vue frontend

**Dependency Graph:**
```
domains (base types)
  ↓
data/client → domains
book-metadata (standalone)
  ↓
server → data/client, book-metadata, domains
cli → data/client, book-metadata, domains
frontend → domains
```

### How It Works

1. **Isolated Type-Checking**: Each package type-checks with its own path mappings
2. **Declaration Files**: Composite packages generate `.d.ts` files in `dist/` directories
3. **Cross-Package Types**: TypeScript uses declaration files instead of following into source code
4. **Incremental Builds**: `.tsbuildinfo` files enable smart rebuilds

### Usage

**Monorepo-wide typecheck:**
```bash
bun run typecheck          # Build all packages in dependency order
bun run typecheck:force    # Clean rebuild
bun run typecheck:clean    # Remove build artifacts
```

**Individual package typecheck:**
```bash
bun run typecheck:data
bun run typecheck:server
bun run typecheck:frontend
bun run typecheck:cli
bun run typecheck:metadata
```

### Build Artifacts

TypeScript generates these files (gitignored):
- `*.tsbuildinfo` - Incremental build cache
- `dist/` - Declaration files for library packages
- `dist-types/` - Declaration files for CLI/frontend (separate from bundle output)
- `dist-types-node/` - Vite config declarations

### Path Mappings

Packages use different path mapping strategies:

**Standard packages** (data, server):
- `@/*` → local `./src/*`
- `@domains/types/*` → `../domains/dist/*` (declaration files)

**CLI** (unique style):
- `@quailcomp/data` → `../data/client/src`
- `@quailcomp/book-metadata` → `../services/book-metadata`
- `@domains/types/*` → `../domains/dist/*`
- `@cli/*` → `./src/*`

**Frontend**:
- `@/*` → `./src/*`
- `@domains/types/*` → `../domains/dist/*`

### Benefits

- **Path alias resolution**: Each package's `@/` aliases resolve correctly
- **Incremental compilation**: Only changed packages rebuild
- **Clear boundaries**: TypeScript enforces module isolation
- **Better IDE support**: Cross-package navigation uses declaration files
- **Type safety**: Declaration files provide strong guarantees at package boundaries
