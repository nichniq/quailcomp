# Dependencies Reference

This document lists all direct dependencies used in the Quailcomp project, organized by workspace and purpose.

## Overview

Quailcomp is a monorepo with multiple workspaces:

- **Root** - Shared dependencies and development tools
- **data/client** - Database client and data layer
- **server** - Backend API server
- **frontend** - Vue.js web application
- **cli** - Command-line interface
- **services/book-metadata** - Book metadata service
- **devtools/ui** - Development tools UI

## Runtime Dependencies

Dependencies required for production environments.

### Root

| Package | Description | Documentation |
|---------|-------------|---------------|
| `minimatch` | Glob pattern matching library used for file filtering | [npm](https://www.npmjs.com/package/minimatch) |
| `xlsx` | Excel file reading and writing | [npm](https://www.npmjs.com/package/xlsx) |

### Server

| Package | Description | Documentation |
|---------|-------------|---------------|
| `@sentry/bun` | Error tracking and performance monitoring for Bun runtime | [docs](https://docs.sentry.io/platforms/javascript/guides/bun/) |
| `jose` | JavaScript module for JSON Object Signing and Encryption (JOSE), used for JWT operations | [npm](https://www.npmjs.com/package/jose) |
| `pino` | Fast and low-overhead JSON logger | [docs](https://getpino.io/) |
| `pino-pretty` | Prettifier for Pino log output in development | [npm](https://www.npmjs.com/package/pino-pretty) |
| `zod` | TypeScript-first schema validation with static type inference | [docs](https://zod.dev/) |

### Frontend

| Package | Description | Documentation |
|---------|-------------|---------------|
| `vue` | Progressive JavaScript framework for building user interfaces | [docs](https://vuejs.org/) |
| `vue-router` | Official router for Vue.js | [docs](https://router.vuejs.org/) |
| `pinia` | Intuitive, type-safe state management for Vue | [docs](https://pinia.vuejs.org/) |

### Services

#### Book Metadata

| Package | Description | Documentation |
|---------|-------------|---------------|
| `fast-xml-parser` | Fast and efficient XML parser for parsing book metadata from external APIs | [npm](https://www.npmjs.com/package/fast-xml-parser) |

## Development Dependencies

Tools for building, linting, type checking, and development workflows.

### Linting & Code Quality

| Package | Workspace | Description |
|---------|-----------|-------------|
| `eslint` | Root | JavaScript and TypeScript linter |
| `@typescript-eslint/eslint-plugin` | Root | ESLint plugin for TypeScript-specific rules |
| `@typescript-eslint/parser` | Root | Parser that allows ESLint to understand TypeScript |
| `eslint-import-resolver-typescript` | Root | Resolves TypeScript imports for ESLint |
| `eslint-plugin-import` | Root | ESLint rules for import/export syntax |
| `eslint-plugin-vue` | Root | Official ESLint plugin for Vue.js |
| `vue-eslint-parser` | Root | Parser for .vue files |
| `markdownlint-cli2` | Root | Command-line interface for markdownlint |

**Configuration:** See [eslint.config.js](../../eslint.config.js) for ESLint configuration.

### TypeScript

| Package | Workspace | Description |
|---------|-----------|-------------|
| `typescript` | Root, Frontend | TypeScript compiler |
| `bun-types` | Root | TypeScript definitions for Bun runtime APIs |
| `@types/bun` | Data, Server, CLI, Book Metadata | TypeScript definitions for Bun (workspace-specific) |
| `vue-tsc` | Frontend | TypeScript command-line support for Vue |

### Build Tools

| Package | Workspace | Description |
|---------|-----------|-------------|
| `vite` | Frontend, DevTools UI | Next-generation frontend build tool and dev server |
| `@vitejs/plugin-vue` | Frontend, DevTools UI | Official Vite plugin for Vue.js single-file components |
| `concurrently` | Root, DevTools UI | Run multiple commands concurrently |

## Testing Dependencies

Test frameworks, utilities, and assertion libraries.

### Test Frameworks

| Package | Workspace | Description | Documentation |
|---------|-----------|-------------|---------------|
| `vitest` | Frontend | Fast unit test framework powered by Vite | [docs](https://vitest.dev/) |
| `@vitest/ui` | Frontend | UI for Vitest test runner | [docs](https://vitest.dev/guide/ui.html) |

**Note:** The Data, Server, CLI, and Book Metadata workspaces use Bun's built-in test runner.

### Testing Utilities

| Package | Workspace | Description |
|---------|-----------|-------------|
| `@vue/test-utils` | Frontend | Official testing utilities for Vue.js components |
| `happy-dom` | Frontend | Lightweight DOM implementation for Node.js, used in tests |
| `jsdom` | Frontend | JavaScript implementation of web standards for Node.js |
| `vitest-localstorage-mock` | Frontend | Mock implementation of localStorage for Vitest tests |
| `fast-check` | Data | Property-based testing library for generating test cases |

## Internal Workspace Dependencies

Cross-workspace dependencies within the monorepo.

| Package | Used By | Purpose |
|---------|---------|---------|
| `@quailcomp/data` | Server, CLI | Database client and data layer access |
| `@quailcomp/book-metadata` | Server, CLI | Book metadata fetching and parsing |

These are referenced using `workspace:*` protocol in package.json files.

## Dependency Management

### Viewing Installed Versions

```bash
# List all dependencies
bun pm ls

# Check for outdated packages
bun outdated

# Update dependencies (interactive)
bun update
```

### Adding Dependencies

```bash
# Add runtime dependency to a workspace
cd <workspace>
bun add <package>

# Add dev dependency
bun add --dev <package>

# Add to root workspace
bun add --cwd . <package>
```

### Workspace Dependencies

Internal workspace dependencies use the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@quailcomp/data": "workspace:*"
  }
}
```

This ensures the local workspace version is always used.

## Version Policy

- **Major dependencies** (Vue, TypeScript, Vite): Keep on latest stable minor version
- **Security updates**: Apply immediately
- **Breaking changes**: Test thoroughly across all workspaces
- **Bun runtime**: Keep `bun-types` in sync with installed Bun version

## Security Notes

- Run `bun audit` regularly to check for security vulnerabilities
- Keep dependencies updated, especially security-critical ones (jwt, validation)
- Review dependency licenses before adding new packages
- Minimize dependencies to reduce attack surface

## Related

- [Development Setup](../how-to/setup-development.md) - Installing dependencies
- [Run Tests](../how-to/run-tests.md) - Testing with installed dependencies
- [Environment Variables](environment-variables.md) - Configuration for runtime dependencies
