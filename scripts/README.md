# Scripts

Project-level setup and maintenance utilities.

## Contents

- [`install-hooks.sh`](install-hooks.sh) - Installs git hooks from [`.githooks/`](../.githooks) directory
- [`test-readme-hook.sh`](test-readme-hook.sh) - Tests the README maintenance pre-commit hook
- [`merge-coverage.ts`](merge-coverage.ts) - Merges LCOV coverage reports from all workspaces with path normalization
- [`coverage-report.ts`](coverage-report.ts) - Generates coverage report and enforces 90% threshold

## Usage

Run scripts from the project root:

```bash
# Install git hooks
bash scripts/install-hooks.sh

# Test README maintenance hook
bash scripts/test-readme-hook.sh

# Generate coverage report (usually run via bun run test:coverage)
bun run scripts/merge-coverage.ts
bun run scripts/coverage-report.ts
```

## Coverage Infrastructure

The coverage scripts merge and report on test coverage across all workspaces:

### `merge-coverage.ts`

Combines LCOV files from all workspaces with intelligent deduplication:

- Normalizes file paths to prevent duplicate entries
- Merges coverage data for files referenced from multiple workspaces
- Preserves function and branch coverage statistics
- Outputs to `coverage/lcov.info` for reporting

### `coverage-report.ts`

Parses merged coverage and enforces quality standards:

- Displays line and function coverage percentages
- Lists coverage by file (sorted by lowest first)
- Enforces 90% threshold for both lines and functions
- Exits with code 1 if below threshold

## Testing

The `test-readme-hook.sh` script verifies the README maintenance hook works correctly:

- Creates test directories and files
- Runs on a temporary branch (safe to run anytime)
- Tests all hook scenarios (missing READMEs, unchanged READMEs, updated READMEs)
- Cleans up automatically

See [Manage Git Hooks](../docs/how-to/manage-git-hooks.md) for detailed instructions.
