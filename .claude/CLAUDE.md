# AI Assistant Instructions

@../CONTRIBUTING.md

## AI-Specific Guidelines

### After Completing Work

- **ALWAYS suggest a commit after completing work** - This is mandatory, not optional
- Double check CONTRIBUTING.md when changes are made to ensure it remains up to date

### Your Role with Domains

When working on features or making architectural decisions:

1. Look for opportunities to create or enhance domain documentation
2. Add new domains when introducing new concepts (e.g., authentication, finances, contacts)
3. Update existing domains when types or concepts evolve
4. Write documentation in Markdown, with types in code blocks
5. Maintain clarity by writing for human understanding first, types second

Before implementing features that touch multiple domains or introduce new concepts, consider whether domain documentation needs to be created or updated.

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
