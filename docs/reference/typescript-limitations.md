# TypeScript Limitations

## Workspace Package Type-Checking

### Issue

Running `bun run typecheck` shows TypeScript errors in workspace packages (`@quailcomp/data` and `@quailcomp/book-metadata`) when type-checked from the server package.

**Example errors:**

```
../data/client/src/db/entities.ts(10,36): error TS2307: Cannot find module '@/errors'
../services/book-metadata/providers/composite.ts(13,8): error TS2307: Cannot find module '@/types'
```


### Root Cause

When TypeScript type-checks the server package:

1. It follows imports to workspace packages (e.g., `import ... from "@quailcomp/data"`)
2. Those packages use `@/` path aliases for internal imports
3. TypeScript tries to resolve these using the server's path mappings
4. The server's `@/*` maps to `server/src/*`, not `data/client/src/*`
5. Module resolution fails

### Why This Doesn't Break Anything

- **Runtime works correctly**: Bun's module resolution handles workspace packages properly
- **All tests pass**: 523 tests across all packages run successfully
- **Individual package typechecks pass**: Each package type-checks correctly in isolation
- **ESLint passes**: Code style and import rules are enforced correctly

The errors only appear when running the monorepo-wide `bun run typecheck` command.

### Workarounds Attempted

1. **Relative imports**: Blocked by ESLint rule requiring `@/` path aliases
2. **Exclude patterns**: TypeScript still follows module resolution into packages
3. **Path mapping overrides**: Creates conflicts between package contexts

### Proper Solution

Implement [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html), which requires:

- Shared base `tsconfig.json` for common compiler options
- `composite: true` and `declaration: true` in all packages
- Building declaration files (`.d.ts`) for workspace packages
- `references` array in consuming packages
- `tsc --build` instead of `tsc --noEmit`

This is a significant refactoring that affects the build pipeline and is out of scope for the current work.

### Recommendation

This is a known limitation of the current TypeScript configuration. Since it doesn't affect runtime behavior or individual package development, it can be safely ignored until TypeScript Project References are implemented project-wide.

**For development:**

- Use individual package typecheck commands: `bun run typecheck:server`, `typecheck:data`, etc.
- These run correctly and catch real type errors
- Only the cross-package monorepo-wide check has issues

**For CI:**

- Consider running individual package typechecks instead of the monorepo-wide check
- Or accept the known cross-package errors (they're consistent and not real bugs)
