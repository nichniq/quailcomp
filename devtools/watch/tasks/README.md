# DevTools Watch Tasks

This directory contains task modules that are executed by the DevTools file watcher system. Each task monitors specific file patterns and performs automated actions when files change.

## Available Tasks

### types-from-docs.ts

Extracts TypeScript type definitions from domain markdown files.

**What it does:**

- Watches all `*.md` files in the `domains/` directory (except README.md)
- Extracts TypeScript code blocks from markdown
- Generates `.ts` files in `domains/types/`
- Uses content hashing to prevent unnecessary regeneration

**Output:** `domains/types/[domain-name].ts`

**Run manually:**

```bash
bun run devtools/watch/tasks/types-from-docs.ts
```

### specs-from-tests.ts

Generates a combined markdown test specification document from all test files.

**What it does:**

- Watches all `*.test.ts` files throughout the repository
- Extracts test structure (describe blocks and test cases) from each file
- Generates a single combined specification document at the project root
- Groups tests by directory for organized navigation
- Uses content hashing to prevent infinite watch loops
- Runs on startup to generate the specification initially

**Output:** `TEST_SPECIFICATIONS.md` (project root)

**Generated spec format:**

```markdown
# Test Specifications

**Generated:** 2026-02-09
**Total Test Files:** 46

This document contains specifications extracted from all test files in the project.

---

## data/client/tests

### entities

**Source:** `data/client/tests/entities.test.ts`

#### Setup & Connection
- Connect to test database
- Verify table exists with correct structure

#### Create Operations
- Create a new entity with auto-generated entity_id
- Create multiple entities

---

## server/tests

### auth

**Source:** `server/tests/auth.test.ts`

#### JWT utilities
- sign token creates valid JWT
- verify valid token returns payload

---
```

**Run manually:**

```bash
bun run devtools/watch/tasks/specs-from-tests.ts
```

**View generated specs:**

- Open DevTools UI: `cd devtools/ui && bun run dev`
- Navigate to the "Specs" tab
- View and search the combined specification document
- Or open `TEST_SPECIFICATIONS.md` directly in your editor

### check-readmes.ts

Validates that directories with code files have README.md files.

**What it does:**

- Watches TypeScript, Vue, and markdown files
- Checks if directories with changed files have README.md
- Warns when READMEs are missing or not updated

**Run manually:**

```bash
bun run devtools/watch/tasks/check-readmes.ts
```

### typecheck-domains.ts

Runs TypeScript type checking on the domains directory.

**What it does:**

- Watches `domains/**/*.ts` files
- Runs `tsc --noEmit` to check for type errors
- Reports any type-checking issues

**Run manually:**

```bash
bun run devtools/watch/tasks/typecheck-domains.ts
```

### lint-staged.ts

Runs ESLint on changed files.

**What it does:**

- Watches all TypeScript, JavaScript, and Vue files
- Runs ESLint on changed files
- Reports linting errors and warnings

**Run manually:**

```bash
bun run devtools/watch/tasks/lint-staged.ts
```

### test-reporter.ts

Generates test results JSON for the DevTools UI.

**What it does:**

- Watches all `.test.ts` and `.spec.ts` files
- Runs all test suites when test files change
- Parses output from both Bun test and Vitest
- Aggregates results into `.devtools/test-results.json`
- Provides test statistics for the DevTools UI Test Specs page

**Output:** `.devtools/test-results.json`

**Run manually:**

```bash
bun run test:report
```

**Result format:**

```json
{
  "timestamp": 1234567890,
  "summary": {
    "passed": 120,
    "failed": 2,
    "skipped": 5,
    "total": 127
  },
  "files": [
    {
      "file": "data/client",
      "passed": 15,
      "failed": 0,
      "skipped": 0,
      "total": 15
    }
  ]
}
```

## Task Structure

All tasks follow a common pattern:

```typescript
import type { TaskResult } from '../types'

export async function taskName(changed: string[]): Promise<TaskResult> {
  const startTime = Date.now()
  const output: string[] = []
  const errors: string[] = []

  try {
    // Task logic here
    output.push('✓ Task completed successfully')

    return {
      success: true,
      stdout: output.join('\n'),
      stderr: '',
      duration: Date.now() - startTime,
    }
  } catch (error) {
    errors.push(`❌ Error: ${error}`)
    return {
      success: false,
      stdout: output.join('\n'),
      stderr: errors.join('\n'),
      duration: Date.now() - startTime,
      error: error as Error,
    }
  }
}

// Standalone execution support
if (import.meta.main) {
  const result = await taskName([])
  console.log(result.stdout)
  if (result.stderr) console.error(result.stderr)
  process.exit(result.success ? 0 : 1)
}
```

## TaskResult Type

```typescript
interface TaskResult {
  success: boolean
  stdout: string       // Progress messages and success info
  stderr: string       // Warnings and errors
  duration: number     // Execution time in milliseconds
  error?: Error        // Error object if task failed
}
```

## Creating New Tasks

1. Create a new `.ts` file in this directory
2. Export an async function that takes `changed: string[]` and returns `Promise<TaskResult>`
3. Add standalone execution support with `if (import.meta.main)`
4. Import and add the task to `../rules.ts`
5. Add tests to `../tests/misc.test.ts`
6. Update this README

## Cache Mechanisms

Tasks that generate files (like `types-from-docs` and `specs-from-tests`) use content hashing to prevent infinite watch loops:

1. Hash input file content (SHA-256)
2. Check cache - if hash matches, use cached output
3. Only write output file if content differs from existing file
4. Update cache only when content actually changes

This ensures that:

- Generated files don't trigger unnecessary watch events
- Tasks are fast when files haven't changed
- The system remains stable and doesn't loop infinitely

## Testing

All tasks should have tests in `devtools/tests/misc.test.ts`:

```typescript
describe('Task Name', () => {
  test('task script exists and exports function', async () => {
    const taskFile = Bun.file('devtools/watch/tasks/task-name.ts')
    expect(await taskFile.exists()).toBe(true)
  })

  test('task performs expected action', async () => {
    // Test task functionality
  })
})
```
