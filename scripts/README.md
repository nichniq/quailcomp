# Scripts

Project-level setup and maintenance utilities.

## Contents

- [`install-hooks.sh`](install-hooks.sh) - Installs git hooks from [`.githooks/`](../.githooks) directory
- [`test-readme-hook.sh`](test-readme-hook.sh) - Tests the README maintenance pre-commit hook

## Usage

Run scripts from the project root:

```bash
# Install git hooks
bash scripts/install-hooks.sh

# Test README maintenance hook
bash scripts/test-readme-hook.sh
```

## Testing

The `test-readme-hook.sh` script verifies the README maintenance hook works correctly:

- Creates test directories and files
- Runs on a temporary branch (safe to run anytime)
- Tests all hook scenarios (missing READMEs, unchanged READMEs, updated READMEs)
- Cleans up automatically

See [Manage Git Hooks](../docs/how-to/manage-git-hooks.md) for detailed instructions.
