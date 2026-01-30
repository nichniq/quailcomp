# Contributing to Quailcomp

Quailcomp is a personal data management system using event-sourced append-only storage. TypeScript monorepo with Bun runtime and PostgreSQL 16.

## Quick Reference

| Task | Command |
|------|---------|
| Run tests | `bun test` |
| Coverage report | `bun run test:coverage` |
| Watch mode | `bun test:watch` |
| Run migrations | `bun run db:migrate` |
| Lint code | `bun run lint` |
| Fix lint issues | `bun run lint:fix` |
| Install git hooks | `bash scripts/install-hooks.sh` |

## Getting Started

- [Development Setup](docs/how-to/setup-development.md) - Install prerequisites, clone, configure database
- [Running Tests](docs/how-to/run-tests.md) - Test commands and writing tests
- [Commit Protocol](docs/how-to/commit-changes.md) - How to commit your changes

## Tutorials

- [Add a New Domain](docs/tutorials/add-a-new-domain.md) - Create a domain from scratch

## How-To Guides

- [Run Migrations](docs/how-to/run-migrations.md) - Create and apply database migrations
- [Write Domain Documentation](docs/how-to/write-domain-docs.md) - Document domain models with types
- [Manage Git Hooks](docs/how-to/manage-git-hooks.md) - Install and customize hooks
- [Backup and Restore](docs/how-to/backup-restore-database.md) - Database backup procedures

## Understanding the Architecture

- [Why Event Sourcing?](docs/explanation/event-sourcing.md) - Entities vs events, append-only storage
- [Database Roles](docs/explanation/database-roles.md) - Why quailcomp_owner vs quailcomp_app
- [Services Architecture](docs/explanation/services-architecture.md) - External integrations

## Reference

- [EntitiesClient API](docs/reference/entities-client.md) - Mutable entities
- [EventsClient API](docs/reference/events-client.md) - Immutable events
- [CLI Reference](docs/reference/cli.md) - Command-line interface
- [API Reference](docs/reference/api.md) - HTTP endpoints
- [Environment Variables](docs/reference/environment-variables.md) - Configuration
- [Domain Models](docs/reference/domains.md) - Index of domain documentation

## Project Structure

```
quailcomp/
├── data/
│   ├── client/           # @quailcomp/data - TypeScript client library
│   └── postgres/         # SQL: setup/, teardown/, migrations/
├── server/               # Backend HTTP server
├── frontend/             # Vue 3 + Pinia frontend
├── cli/                  # Command-line interface
├── services/             # External integrations (book-metadata)
├── domains/              # Domain documentation with embedded types
├── docs/                 # Documentation (Diátaxis structure)
│   ├── tutorials/        # Learning-oriented guides
│   ├── how-to/           # Task-oriented guides
│   ├── explanation/      # Understanding-oriented
│   └── reference/        # Information-oriented
└── CONTRIBUTING.md       # This file
```

## Development Rules

- Run `bun test` after modifying code
- Maintain 90% code coverage (enforced in CI)
- Use Bun's SQL tagged templates (not raw strings)
- Use `EntitiesClient` for mutable data, `EventsClient` for immutable facts
- Tests must use unique type names (with timestamps)
- Never modify existing migration files
- Migrations must be idempotent

## Avoid

- External PostgreSQL drivers (Bun has built-in support)
- Truncating tables in tests
- Direct SQL string concatenation (SQL injection risk)
