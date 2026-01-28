# Git Hooks

This directory contains git hook templates. See [How to Manage Git Hooks](../docs/how-to/manage-git-hooks.md) for complete documentation.

## Quick Start

```bash
bash scripts/install-hooks.sh
```

## What the Pre-Commit Hook Does

- Runs ESLint on staged `.ts`, `.tsx`, `.js`, `.jsx`, and `.vue` files
- Extracts types from domain documentation when `.md` files change
- Blocks commit on linting errors

## Bypassing (Use Sparingly)

```bash
git commit --no-verify
```
