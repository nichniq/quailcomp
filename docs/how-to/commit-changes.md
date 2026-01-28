# How to Commit Changes

This guide covers the commit protocol for Quailcomp.

## Before Committing

### 1. Run Tests

```bash
bun test
```

All tests must pass before committing. See [How to Run Tests](run-tests.md) for details.

### 2. Check Linting

```bash
bun run lint
```

Fix any issues:

```bash
bun run lint:fix
```

## Creating a Commit

### 1. Stage Your Changes

Stage specific files rather than using `git add -A`:

```bash
git add src/feature.ts tests/feature.test.ts
```

This avoids accidentally committing sensitive files (`.env`, credentials) or large binaries.

### 2. Write the Commit Message

Use this format:

- **Subject line**: Imperative mood, concise summary
- **Body**: Bullet points describing specific changes
- **Co-authorship**: Include if working with AI assistance

```bash
git commit -m "$(cat <<'EOF'
Add user authentication endpoint

- Create POST /auth/login route handler
- Add JWT token generation
- Write integration tests for auth flow

Co-Authored-By: AI Assistant <noreply@example.com>
EOF
)"
```

### Subject Line Guidelines

Use imperative mood (like giving a command):

| Good | Bad |
|------|-----|
| Add feature X | Added feature X |
| Fix bug in Y | Fixes bug in Y |
| Update documentation | Updated documentation |

Keep it concise - around 50 characters.

### Body Guidelines

- Use bullet points for multiple changes
- Explain what changed, not how
- Reference issue numbers if applicable

## Pre-Commit Hook

The pre-commit hook runs automatically and:

- Lints staged TypeScript/JavaScript/Vue files
- Extracts types from domain documentation if `.md` files changed
- Blocks commit if linting fails

### If the Hook Fails

1. Review the error message
2. Fix the issues
3. Stage the fixes: `git add <fixed-files>`
4. Commit again

### Bypassing the Hook (Use Sparingly)

```bash
git commit --no-verify
```

Only use this when you understand why the hook is failing and have a good reason to bypass it.

## Examples

### Simple Change

```bash
git add src/utils/format.ts
git commit -m "Fix date formatting for ISO 8601 compliance"
```

### Feature with Multiple Files

```bash
git add src/routes/books.ts src/services/metadata.ts tests/books.test.ts
git commit -m "$(cat <<'EOF'
Add book metadata lookup endpoint

- Create POST /books/metadata/lookup route
- Integrate with Google Books API
- Add fallback to Open Library
- Write tests for success and error cases
EOF
)"
```

### With AI Assistance

```bash
git commit -m "$(cat <<'EOF'
Refactor database connection pooling

- Extract connection config to separate module
- Add connection timeout handling
- Improve error messages for connection failures

Co-Authored-By: AI Assistant <noreply@example.com>
EOF
)"
```

### Bug Fix with Issue Reference

```bash
git commit -m "$(cat <<'EOF'
Fix race condition in event recording (#42)

- Add mutex lock around event_id generation
- Ensure atomic read-modify-write
EOF
)"
```

## After Committing

### Verify the Commit

```bash
git log -1  # View the commit
git show    # View commit with diff
```

### Push When Ready

Only push when you're confident in your changes:

```bash
git push
```

## Common Issues

### Commit Blocked by Linting

The pre-commit hook runs ESLint on staged files. Fix issues with:

```bash
bun run lint:fix
git add <fixed-files>
git commit  # Try again
```

### Accidental Sensitive File Staged

Remove it from staging:

```bash
git reset HEAD .env
```

Add to `.gitignore` if it shouldn't be tracked:

```bash
echo ".env" >> .gitignore
```

### Wrong Branch

If you committed to the wrong branch:

```bash
# Undo the commit (keeps changes staged)
git reset --soft HEAD~1

# Switch to correct branch
git checkout correct-branch

# Commit there
git commit
```

## Related

- [Run Tests](run-tests.md) - Verify changes before committing
- [Manage Git Hooks](manage-git-hooks.md) - Pre-commit hook details
- [Development Setup](setup-development.md) - Install git hooks
