# Git Hooks

This directory contains git hook templates that can be installed manually.

## Installation

To install the pre-commit hook:

```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## What the pre-commit hook does

- Runs ESLint on all staged `.ts`, `.tsx`, `.js`, `.jsx`, and `.vue` files
- Prevents commits if linting errors are found
- Suggests running `bun run lint:fix` to auto-fix issues

## Bypassing the hook

If you need to commit despite linting errors (use sparingly):

```bash
git commit --no-verify
```

## Future improvements

When the team grows or you want easier hook management, consider:

- `simple-git-hooks` - Lightweight hook manager (~100 LOC)
- `husky` - Popular but more complex
- `lint-staged` - Only lint files that are staged (faster)
