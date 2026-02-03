/**
 * Integration tests for the no-unsafe-sql ESLint rule
 *
 * These tests verify the rule works by linting actual code files.
 * Run with: bun test eslint-rules/no-unsafe-sql.test.js
 */

import { test, expect } from 'bun:test';
import { ESLint } from 'eslint';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), '.eslint-test-temp');

// Create a temporary directory for test files within the project
if (!existsSync(TEST_DIR)) {
  mkdirSync(TEST_DIR, { recursive: true });
}

async function lintCode(filename, code) {
  const filePath = join(TEST_DIR, filename);
  writeFileSync(filePath, code);

  const eslint = new ESLint({
    overrideConfigFile: 'eslint.config.js',
    cwd: process.cwd(),
  });

  try {
    const results = await eslint.lintFiles([filePath]);
    return results[0].messages;
  } finally {
    try {
      unlinkSync(filePath);
    } catch (e) {
      // File might already be deleted
    }
  }
}

test('no-unsafe-sql - allows Bun SQL tagged templates', async () => {
  const messages = await lintCode(
    'valid-tagged.ts',
    'const result = await sql`SELECT * FROM users WHERE id = ${userId}`;'
  );
  expect(messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql')).toHaveLength(0);
});

test('no-unsafe-sql - allows this.sql tagged templates', async () => {
  const messages = await lintCode(
    'valid-this-sql.ts',
    'const result = await this.sql`SELECT * FROM users WHERE id = ${userId}`;'
  );
  expect(messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql')).toHaveLength(0);
});

test('no-unsafe-sql - allows transaction tagged templates', async () => {
  const messages = await lintCode(
    'valid-tx.ts',
    'const result = await tx`SELECT * FROM users WHERE id = ${userId}`;'
  );
  expect(messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql')).toHaveLength(0);
});

test('no-unsafe-sql - allows empty SQL fragments', async () => {
  const messages = await lintCode(
    'valid-fragments.ts',
    'const clause = includeDeleted ? sql`` : sql`AND deleted_at IS NULL`;'
  );
  expect(messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql')).toHaveLength(0);
});

test('no-unsafe-sql - allows non-SQL strings', async () => {
  const messages = await lintCode(
    'valid-string.ts',
    'const message = "Hello, world!";'
  );
  expect(messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql')).toHaveLength(0);
});

test('no-unsafe-sql - rejects string concatenation with SQL', async () => {
  const messages = await lintCode(
    'invalid-concat.ts',
    'const query = "SELECT * FROM users WHERE id = " + userId;'
  );
  const sqlErrors = messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql');
  expect(sqlErrors.length).toBeGreaterThan(0);
  expect(sqlErrors[0].message).toContain('string concatenation');
});

test('no-unsafe-sql - rejects untagged template literals with SQL', async () => {
  const messages = await lintCode(
    'invalid-template.ts',
    'const query = `SELECT * FROM users WHERE id = ${userId}`;'
  );
  const sqlErrors = messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql');
  expect(sqlErrors.length).toBeGreaterThan(0);
  expect(sqlErrors[0].message).toContain('tagged templates');
});

test('no-unsafe-sql - rejects SQL string in method calls', async () => {
  const messages = await lintCode(
    'invalid-method-string.ts',
    'db.query("SELECT * FROM users WHERE id = 1");'
  );
  const sqlErrors = messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql');
  expect(sqlErrors.length).toBeGreaterThan(0);
});

test('no-unsafe-sql - rejects SQL template literal in method calls', async () => {
  const messages = await lintCode(
    'invalid-method-template.ts',
    'db.execute(`SELECT * FROM users WHERE id = ${userId}`);'
  );
  const sqlErrors = messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql');
  expect(sqlErrors.length).toBeGreaterThan(0);
});

test('no-unsafe-sql - rejects SQL string variable assignment', async () => {
  const messages = await lintCode(
    'invalid-var-string.ts',
    'const query = "SELECT * FROM users";'
  );
  const sqlErrors = messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql');
  expect(sqlErrors.length).toBeGreaterThan(0);
});

test('no-unsafe-sql - rejects SQL template literal variable assignment', async () => {
  const messages = await lintCode(
    'invalid-var-template.ts',
    'const query = `INSERT INTO users (name) VALUES (${name})`;'
  );
  const sqlErrors = messages.filter((m) => m.ruleId === 'custom-rules/no-unsafe-sql');
  expect(sqlErrors.length).toBeGreaterThan(0);
});
