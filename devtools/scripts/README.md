# DevTools Scripts

Standalone scripts for DevTools infrastructure and tooling.

## Contents

### test-reporter.ts

Automated test results reporter that:

- Runs all test suites (data/client, server, cli, frontend)
- Parses test output from Bun test and Vitest
- Aggregates results into `.devtools/test-results.json`
- Used by both the main test command and watch system

**Usage:**

```bash
bun run test:report
```

### setup-storage.ts

Storage directory initialization script that:

- Creates `.devtools/` directory
- Initializes empty test results file
- Updates `.gitignore` if needed

**Usage:**

```bash
bun run devtools/scripts/setup-storage.ts
```

## Output Format

Test results are stored in `.devtools/test-results.json`:

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

This format matches the `TestResults` interface in `devtools/ui/src/types.ts`.
