# Custom ESLint Rules

This directory contains custom ESLint rules for the quailcomp project.

## Rules

### `no-unsafe-sql`

Enforces parameterized SQL queries using Bun's tagged template syntax to prevent SQL injection vulnerabilities.

**Rule:** `custom-rules/no-unsafe-sql`

**Severity:** `error`

**Description:**

This rule ensures all SQL queries use Bun's SQL tagged templates (e.g., `sql\`SELECT * FROM users WHERE id = ${id}\``) instead of:

- String concatenation (`"SELECT * FROM users WHERE id = " + id`)
- Regular template literals (`` `SELECT * FROM users WHERE id = ${id}` ``)
- Raw SQL strings passed to query methods

**Valid Examples:**

```typescript
// Using Bun tagged template with parameters
const result = await sql`SELECT * FROM users WHERE id = ${userId}`;

// Using instance method
const result = await this.sql`SELECT * FROM users WHERE id = ${userId}`;

// Using transaction variable
await this.sql.begin(async (tx) => {
  const rows = await tx`
    INSERT INTO users (name) VALUES (${name})
    RETURNING *
  `;
});

// Empty template fragments for dynamic queries
const clause = includeDeleted ? sql`` : sql`AND deleted_at IS NULL`;
```

**Invalid Examples:**

```typescript
// ❌ String concatenation
const query = "SELECT * FROM users WHERE id = " + userId;

// ❌ Regular template literal
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ❌ SQL method with string
db.query("SELECT * FROM users WHERE id = 1");

// ❌ SQL method with template literal
db.execute(`SELECT * FROM users WHERE id = ${userId}`);
```

**Rationale:**

Bun's SQL tagged templates automatically parameterize queries, preventing SQL injection attacks by ensuring user input is properly escaped. This rule enforces this security best practice across the codebase.

## Testing

Run tests for the custom rules:

```bash
bun test eslint-rules/
```

## Adding New Rules

To add a new custom rule:

1. Create a new file in this directory (e.g., `my-rule.js`)
2. Export a rule object following ESLint's rule structure
3. Add the rule to [eslint.config.js](../eslint.config.js)
4. Create a test file (e.g., `my-rule.test.js`)
5. Update this README with documentation

See [no-unsafe-sql.js](./no-unsafe-sql.js) for an example.
