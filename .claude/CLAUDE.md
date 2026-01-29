# AI Assistant Instructions

## Key Documentation

Before working on tasks, reference these docs as needed:

- [Development Setup](../docs/how-to/setup-development.md) - Environment and database setup
- [Running Tests](../docs/how-to/run-tests.md) - Test commands and patterns
- [Commit Protocol](../docs/how-to/commit-changes.md) - How to commit changes
- [Run Migrations](../docs/how-to/run-migrations.md) - Database migrations
- [Event Sourcing](../docs/explanation/event-sourcing.md) - Entities vs events
- [Database Roles](../docs/explanation/database-roles.md) - quailcomp_owner vs quailcomp_app
- [Environment Variables](../docs/reference/environment-variables.md) - Configuration reference

## Quick Reference

| Task | Command |
|------|---------|
| Run tests | `bun test` |
| Run migrations | `bun run db:migrate` |
| Install git hooks | `bash scripts/install-hooks.sh` |
| Lint code | `bun run lint` |

## Development Rules

- Run `bun test` after modifying code
- Use Bun's SQL tagged templates (not raw strings)
- Use `EntitiesClient` for mutable data, `EventsClient` for immutable facts
- Tests must use unique type names (with timestamps)
- Never modify existing migration files
- Migrations must be idempotent

## AI-Specific Guidelines

### After Completing Work

- **ALWAYS suggest a commit after completing work** - This is mandatory, not optional
- Double check CONTRIBUTING.md when changes are made to ensure it remains up to date
- Review if any directory READMEs need updates based on changes made

### README Maintenance

Every directory should have a README.md explaining its purpose and contents. When working:

- **Adding new files**: Update the directory's README.md to document them
- **Removing files**: Update the directory's README.md to remove references
- **Creating directories**: Create a README.md explaining the new directory's purpose
- **Changing architecture**: Update affected READMEs to reflect new patterns
- **Before committing**: Check if READMEs in modified directories need updates

See [README Maintenance Checklist](../docs/how-to/maintain-readmes.md) for details.

### Infrastructure Testing

Proactively add tests to `misc.test.ts` for infrastructure scripts and tooling:

- **When creating scripts**: Add tests to verify they work correctly
- **When testing scripts manually**: Convert manual tests to automated tests in `misc.test.ts`
- **When modifying hooks or tooling**: Ensure tests exist and update them
- **Good candidates for testing**:
  - Git hooks and their behavior
  - Build/deployment scripts
  - Database setup/teardown scripts
  - Configuration validation
  - File generation scripts
  - CI/CD workflow components

Tests in `misc.test.ts` run automatically with `bun test`, providing confidence that project infrastructure works correctly.

### Your Role with Domains

When working on features or making architectural decisions:

1. Look for opportunities to create or enhance domain documentation
2. Add new domains when introducing new concepts (e.g., authentication, finances, contacts)
3. Update existing domains when types or concepts evolve
4. Write documentation in Markdown, with types in code blocks
5. Maintain clarity by writing for human understanding first, types second

Before implementing features that touch multiple domains or introduce new concepts, consider whether domain documentation needs to be created or updated.

See [Write Domain Documentation](../docs/how-to/write-domain-docs.md) for guidelines.

---

## Help Me Improve These Instructions

When you notice opportunities, suggest additions:

- **After fixing a bug**: "Should I add a rule about [pattern that caused the bug]?"
- **After I clarify a preference**: "Want me to add that to CONTRIBUTING.md so I remember?"
- **After repeated questions**: "I've asked about [X] a few times. Should this be documented?"
- **When conventions emerge**: "I notice you prefer [pattern]. Add to rules?"

Good instruction entries are:

- **Directive**: "Do X" or "Avoid Y" (not just descriptions)
- **Specific**: "Use `bun test`" (not "run tests appropriately")
- **Born from friction**: Rules that prevent real mistakes you've encountered
