# How to Manage Git Hooks

This guide covers installing and customizing git hooks in Quailcomp.

## Overview

Git hooks are stored as templates in `.githooks/` and installed to `.git/hooks/`. This allows hooks to be version-controlled while keeping the actual hook files outside of git's tracking.

## Installing Hooks

```bash
bash scripts/install-hooks.sh
```

This copies hooks from `.githooks/` to `.git/hooks/` and makes them executable.

## What the Pre-Commit Hook Does

The pre-commit hook runs before each commit:

1. **Lints staged files** - Runs ESLint on `.ts`, `.tsx`, `.js`, `.jsx`, and `.vue` files
2. **Extracts domain types** - Regenerates TypeScript from Markdown when `.md` files change
3. **Blocks on failure** - Prevents commit if linting errors are found

## Modifying Hooks

### Edit the Template

Hooks are templates in `.githooks/`. Edit the template, not `.git/hooks/`:

```bash
# Edit the template
nano .githooks/pre-commit

# Reinstall to apply changes
bash scripts/install-hooks.sh
```

### Sync Warning

The pre-commit hook checks if it's out of sync with the template. If you see a warning:

```
Warning: .git/hooks/pre-commit differs from .githooks/pre-commit
```

Run the install script to update:

```bash
bash scripts/install-hooks.sh
```

## Bypassing Hooks

If you need to commit despite hook failures (use sparingly):

```bash
git commit --no-verify
```

Common reasons to bypass:

- Work-in-progress commit that you'll fix later
- Linting rule that doesn't apply to your change
- Emergency fix that needs immediate deployment

## Creating New Hooks

### 1. Create the Template

```bash
touch .githooks/pre-push
chmod +x .githooks/pre-push
```

### 2. Add Hook Logic

```bash
#!/bin/bash
set -euo pipefail

echo "Running pre-push checks..."

# Your checks here
bun test

echo "Pre-push checks passed!"
```

### 3. Update Install Script

If needed, update `scripts/install-hooks.sh` to include the new hook.

### 4. Install

```bash
bash scripts/install-hooks.sh
```

## Available Git Hooks

Common hooks you might use:

| Hook | When it Runs |
|------|--------------|
| `pre-commit` | Before commit is created |
| `commit-msg` | After commit message is entered |
| `pre-push` | Before push to remote |
| `post-merge` | After merge completes |
| `post-checkout` | After checkout completes |

## Current Hooks

### pre-commit

**Location:** `.githooks/pre-commit`

**Actions:**

1. Checks for staged `.ts`, `.tsx`, `.js`, `.jsx`, `.vue` files
2. Runs ESLint on those files
3. If any domain `.md` files changed, extracts types
4. Exits with error if linting fails

**Example output on failure:**

```
Running ESLint on staged files...

/path/to/file.ts
  10:5  error  'unused' is defined but never used  @typescript-eslint/no-unused-vars

ESLint found errors. Please fix them before committing.
You can run 'bun run lint:fix' to auto-fix some issues.
```

## Troubleshooting

### Hook Not Running

Verify the hook is installed and executable:

```bash
ls -la .git/hooks/pre-commit
# Should show -rwxr-xr-x
```

Reinstall if needed:

```bash
bash scripts/install-hooks.sh
```

### Hook Runs But Doesn't Catch Issues

Ensure the hook is checking the right files. The pre-commit hook only checks **staged** files, not all modified files.

### Different Behavior Than Expected

Check if `.git/hooks/pre-commit` matches `.githooks/pre-commit`:

```bash
diff .githooks/pre-commit .git/hooks/pre-commit
```

If different, reinstall hooks.

## Future Improvements

For larger teams, consider:

- **simple-git-hooks** - Lightweight hook manager (~100 LOC)
- **husky** - Popular but more complex
- **lint-staged** - Only lint staged files (faster for large codebases)

These tools can be configured in `package.json` and automatically install hooks on `bun install`.

## Related

- [Commit Changes](commit-changes.md) - Commit protocol
- [Run Tests](run-tests.md) - Testing before commit
- [Write Domain Docs](write-domain-docs.md) - Domain type extraction
