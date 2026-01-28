#!/bin/bash
# Install git hooks from .githooks/ to .git/hooks/
#
# Run this script after cloning the repository or when hooks are updated.

set -e

HOOKS_DIR=".githooks"
GIT_HOOKS_DIR=".git/hooks"

echo "Installing git hooks..."

# Check if .githooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌ Error: $HOOKS_DIR directory not found"
  exit 1
fi

# Check if .git/hooks directory exists
if [ ! -d "$GIT_HOOKS_DIR" ]; then
  echo "❌ Error: $GIT_HOOKS_DIR directory not found. Are you in a git repository?"
  exit 1
fi

# Copy all hooks from .githooks to .git/hooks
for hook in "$HOOKS_DIR"/*; do
  if [ -f "$hook" ]; then
    hook_name=$(basename "$hook")
    # Skip README files
    if [ "$hook_name" = "README.md" ]; then
      continue
    fi
    cp "$hook" "$GIT_HOOKS_DIR/$hook_name"
    chmod +x "$GIT_HOOKS_DIR/$hook_name"
    echo "✅ Installed $hook_name"
  fi
done

echo ""
echo "✅ Git hooks installed successfully!"
echo "   Hooks are now active in .git/hooks/"
