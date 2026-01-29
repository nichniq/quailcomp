#!/bin/bash
# Test script for README maintenance pre-commit hook
#
# This script verifies that the pre-commit hook correctly detects:
# 1. New directories without READMEs
# 2. Modified files in directories with unchanged READMEs
#
# Usage:
#   bash scripts/test-readme-hook.sh

set -e

echo "Testing README maintenance pre-commit hook..."
echo ""

# Store current branch
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Create a test branch
TEST_BRANCH="test-readme-hook-$$"
git checkout -b "$TEST_BRANCH" 2>/dev/null || true

cleanup() {
  echo ""
  echo "Cleaning up..."
  git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
  git branch -D "$TEST_BRANCH" 2>/dev/null || true
  rm -rf test-new-directory 2>/dev/null || true
  echo "✅ Cleanup complete"
}

trap cleanup EXIT

# Test 1: New directory without README
echo "Test 1: Creating new directory without README..."
mkdir -p test-new-directory
echo "export const test = 'hello'" > test-new-directory/test.ts

git add test-new-directory/test.ts

echo "Running git commit (should warn about missing README)..."
OUTPUT=$(git commit -m "Test: new directory without README" 2>&1) || true

if echo "$OUTPUT" | grep -q "New directories without README.md"; then
  echo "✅ Test 1 PASSED: Hook detected missing README"
else
  echo "❌ Test 1 FAILED: Hook did not detect missing README"
  echo "$OUTPUT"
  exit 1
fi

# Reset the test commit
git reset --soft HEAD~1 2>/dev/null || true
git reset HEAD test-new-directory/test.ts

echo ""

# Test 2: Existing directory with README, file added but README not updated
echo "Test 2: Adding file to directory without updating README..."

# Use an existing directory with a README
echo "export const newFeature = 'test'" > cli/src/commands/new-command.ts
git add cli/src/commands/new-command.ts

echo "Running git commit (should warn about unchanged README)..."
OUTPUT=$(git commit -m "Test: add file without updating README" 2>&1) || true

if echo "$OUTPUT" | grep -q "Files changed but README not updated"; then
  echo "✅ Test 2 PASSED: Hook detected unchanged README"
else
  echo "❌ Test 2 FAILED: Hook did not detect unchanged README"
  echo "$OUTPUT"
  exit 1
fi

# Reset the test commit
git reset --soft HEAD~1 2>/dev/null || true
git reset HEAD cli/src/commands/new-command.ts
rm -f cli/src/commands/new-command.ts

echo ""

# Test 3: Adding file AND updating README (should pass cleanly)
echo "Test 3: Adding file and updating README together..."

echo "export const anotherFeature = 'test'" > cli/src/commands/another-command.ts
# Simulate updating the README (just touch it to change modification time)
echo "" >> cli/src/commands/README.md

git add cli/src/commands/another-command.ts cli/src/commands/README.md

echo "Running git commit (should not warn)..."
OUTPUT=$(git commit -m "Test: add file with README update" 2>&1) || true

if echo "$OUTPUT" | grep -q "Files changed but README not updated.*cli/src/commands"; then
  echo "❌ Test 3 FAILED: Hook warned even though README was updated"
  echo "$OUTPUT"
  exit 1
else
  echo "✅ Test 3 PASSED: Hook did not warn when README was updated"
fi

# Reset the test commit
git reset --soft HEAD~1 2>/dev/null || true
git reset HEAD cli/src/commands/another-command.ts cli/src/commands/README.md
rm -f cli/src/commands/another-command.ts
git checkout cli/src/commands/README.md

echo ""
echo "================================================"
echo "All tests passed! ✅"
echo "The README maintenance hook is working correctly."
echo "================================================"
