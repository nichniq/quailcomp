# Maintain README Files

Every directory in this project should have a README.md file explaining its purpose and contents. This guide helps you keep them up to date.

## When to Update READMEs

### Creating a New Directory

**When**: You create a new directory for organizing code, documentation, or other files.

**Action**: Create a `README.md` in the new directory.

**Template**:

```markdown
# Directory Name

Brief description of what this directory contains and its purpose.

## Files

- [`filename.ts`](filename.ts) - Description of what this file does
- [`another-file.ts`](another-file.ts) - Description

## Usage

```typescript
// Example of how to use code in this directory
import { something } from './filename'
```

## Documentation

- [Related Doc](../../path/to/doc.md)

```

**Example**: Creating `server/src/email/`

```markdown
# Email Service

Email sending and template rendering functionality.

## Files

- [`sender.ts`](sender.ts) - Email sending via SMTP
- [`templates.ts`](templates.ts) - Email template rendering
- [`types.ts`](types.ts) - Type definitions

## Usage

```typescript
import { emailService } from './email'

await emailService.send({
  to: 'user@example.com',
  subject: 'Welcome',
  template: 'welcome',
  data: { name: 'John' }
})
```

```

### Adding New Files

**When**: You add new files to an existing directory.

**Action**: Update that directory's README.md to document the new files.

**What to add**:
- File name and link in the "Files" section
- Brief description of what the file does
- Update usage examples if the new file changes how the directory is used

**Example**: Adding `password-reset.ts` to `server/src/email/`

```diff
## Files

- [`sender.ts`](sender.ts) - Email sending via SMTP
- [`templates.ts`](templates.ts) - Email template rendering
+ - [`password-reset.ts`](password-reset.ts) - Password reset email workflow
- [`types.ts`](types.ts) - Type definitions
```

### Removing Files

**When**: You delete files from a directory.

**Action**: Remove references to deleted files from the README.md.

**What to remove**:

- File entries from the "Files" section
- Usage examples that reference the deleted file
- Any documentation sections specific to the removed file

**Example**: Removing `old-mailer.ts`

```diff
## Files

- [`sender.ts`](sender.ts) - Email sending via SMTP
- - [`old-mailer.ts`](old-mailer.ts) - Legacy email sender (deprecated)
- [`templates.ts`](templates.ts) - Email template rendering
```

### Renaming Files

**When**: You rename files in a directory.

**Action**: Update file references in the README.md.

**What to update**:

- File name and link in the "Files" section
- Usage examples that import the file
- Keep the same description unless the purpose changed

### Changing Architecture

**When**: You refactor or restructure code in a way that changes how a directory works.

**Action**: Update the README.md to reflect the new architecture.

**What to update**:

- Directory description if purpose changed
- Usage examples to show new patterns
- Add migration notes if breaking changes
- Update links to related documentation

**Example**: Switching from REST to GraphQL in `server/src/api/`

```diff
# API Routes

- HTTP route handlers for RESTful API endpoints.
+ GraphQL schema and resolvers for the API.

## Files

- - [`books.ts`](books.ts) - Book management endpoints (CRUD operations)
- - [`health.ts`](health.ts) - Health check endpoint
+ - [`schema.graphql`](schema.graphql) - GraphQL schema definitions
+ - [`resolvers/`](resolvers/) - GraphQL resolver implementations
+ - [`context.ts`](context.ts) - GraphQL context builder
```

### Moving Files Between Directories

**When**: You move files from one directory to another.

**Action**: Update both the source and destination README files.

**What to update**:

- Remove file entry from source README
- Add file entry to destination README
- Update any cross-references between READMEs

## Pre-Commit Checklist

Before committing changes, verify:

- [ ] **New directories** have a README.md file
- [ ] **New files** are documented in their directory's README
- [ ] **Removed files** are removed from READMEs
- [ ] **Renamed files** have updated references
- [ ] **Architecture changes** are reflected in affected READMEs
- [ ] **Usage examples** are still accurate
- [ ] **Links** to other docs still work

The git pre-commit hook will remind you about potential README updates, but won't block commits.

## README Structure

A good directory README includes:

### 1. Title and Purpose (Required)

```markdown
# Directory Name

One or two sentences explaining what this directory contains.
```

### 2. File Listing (Required)

```markdown
## Files

- [`file1.ts`](file1.ts) - Description
- [`file2.ts`](file2.ts) - Description
```

For directories with subdirectories:

```markdown
## Structure

- [**subdir1/**](subdir1/) - Subdirectory purpose
- [**subdir2/**](subdir2/) - Subdirectory purpose
- [`file.ts`](file.ts) - File description
```

### 3. Usage Examples (Recommended)

```markdown
## Usage

```typescript
import { something } from './file'

// Example usage
```

```

### 4. Related Documentation (Recommended)

```markdown
## Documentation

- [Related Guide](../../docs/how-to/guide.md)
- [Explanation](../../docs/explanation/concept.md)
```

### 5. Additional Sections (Optional)

Add sections as needed:

- `## Installation` - Setup instructions
- `## Configuration` - Configuration options
- `## Testing` - How to run tests
- `## API` - API reference
- `## Examples` - Extended examples

## Tips

### Keep It Concise

READMEs should be scannable. One or two sentences per file is enough.

**Good**:

```markdown
- [`auth.ts`](auth.ts) - Authentication middleware for protected routes
```

**Too verbose**:

```markdown
- [`auth.ts`](auth.ts) - This file contains the authentication middleware which is used to protect routes that require the user to be logged in. It checks the JWT token from the request header, validates it, and attaches the user object to the request context if valid. If the token is missing or invalid, it returns a 401 Unauthorized response.
```

### Use Relative Links

Link to files and docs using relative paths so they work in different contexts:

```markdown
- See [Setup Guide](../../docs/how-to/setup.md)
- Import from [`../utils/helpers.ts`](../utils/helpers.ts)
```

### Group Related Files

If a directory has many files, group them by category:

```markdown
## Files

### Core Services
- [`auth.ts`](auth.ts) - Authentication
- [`authz.ts`](authz.ts) - Authorization

### Utilities
- [`logger.ts`](logger.ts) - Logging
- [`metrics.ts`](metrics.ts) - Metrics

### Types
- [`types.ts`](types.ts) - Shared types
```

### Update During Development

Don't wait until the end. Update READMEs as you code:

1. Create file → Add to README immediately
2. Delete file → Remove from README immediately
3. Change how something works → Update README immediately

This prevents forgetting details and keeps the README accurate.

## Automation

The git pre-commit hook checks for README maintenance issues:

- Warns when new directories don't have READMEs
- Reminds when files change but the README doesn't

These are warnings, not errors. Use your judgment about whether updates are needed.

### Testing the Hook

The README maintenance hook is tested automatically when you run:

```bash
bun test
```

The tests are in [`misc.test.ts`](../../misc.test.ts) and verify:

- New directories without READMEs trigger warnings
- Files added without updating READMEs trigger warnings
- Files added WITH README updates don't trigger warnings

You can also run the standalone test script:

```bash
bash scripts/test-readme-hook.sh
```

Both approaches test all scenarios and clean up automatically.

## Examples

See existing READMEs throughout the codebase for examples:

- [server/src/auth/](../../server/src/auth/README.md) - Service directory
- [cli/src/commands/](../../cli/src/commands/README.md) - Command implementations
- [frontend/src/components/](../../frontend/src/components/README.md) - Component library
- [domains/types/](../../domains/types/README.md) - Generated files directory
- [data/postgres/](../../data/postgres/README.md) - Infrastructure directory

## Questions?

If you're unsure whether a README needs updating, ask yourself:

1. Would a new developer understand this directory without the README?
2. Does the README accurately describe what's in the directory today?
3. Are there files in the directory not mentioned in the README?

If the answer to any is "no," update the README.
