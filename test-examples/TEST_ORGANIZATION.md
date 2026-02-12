# Strategic Test Organization

## File Structure Strategy

### Co-located Tests (Preferred)

Keep tests close to the code they test for better discoverability and maintenance.

```
src/
  core/
    compiler/
      Compiler.ts
      Compiler.test.ts              # Unit tests
      Compiler.integration.test.ts  # Integration tests

  components/
    QuailEditor/
      QuailEditor.tsx
      QuailEditor.test.tsx
      QuailEditor.spec.tsx           # Alternative: spec for E2E
      hooks/
        useQuailState.ts
        useQuailState.test.ts

  services/
    api/
      QuailAPI.ts
      QuailAPI.test.ts
      __mocks__/
        QuailAPI.ts                  # Mock implementation
```

### Centralized Tests (When Needed)

For integration and E2E tests that span multiple modules.

```
tests/
  integration/
    compiler/
      document-compilation.test.ts
      error-handling.test.ts
    api/
      endpoint-contracts.test.ts

  e2e/
    workflows/
      document-lifecycle.spec.ts
      collaboration.spec.ts

  fixtures/                    # Shared test data
    documents/
      sample.quail
      complex.quail
      malformed.quail
    responses/
      api-success.json
      api-error.json

  factories/                   # Data builders
    DocumentFactory.ts
    UserFactory.ts
    CompilerOptionsFactory.ts

  utils/                       # Test helpers
    render.tsx
    setup-test-env.ts
    custom-matchers.ts

  setup/                       # Test configuration
    jest.setup.ts
    vitest.setup.ts
```

## Test Suite Organization

### 1. Grouping by Feature

```typescript
// src/core/compiler/Compiler.test.ts

describe('Compiler', () => {
  describe('Basic Compilation', () => {
    test('should compile valid Quail document to AST', () => {});
    test('should preserve document structure', () => {});
    test('should handle empty documents', () => {});
  });

  describe('Error Handling', () => {
    test('should report syntax errors with line numbers', () => {});
    test('should collect multiple errors in single pass', () => {});
    test('should recover from errors gracefully', () => {});
  });

  describe('Performance', () => {
    test('should compile large documents efficiently', () => {});
    test('should cache parsing results', () => {});
  });

  describe('Options', () => {
    test('should respect strictMode option', () => {});
    test('should apply custom transformations', () => {});
  });
});
```

### 2. Grouping by Scenario

```typescript
// tests/integration/document-lifecycle.test.ts

describe('Document Lifecycle', () => {
  describe('Creating a new document', () => {
    test('should initialize with default template', () => {});
    test('should validate document metadata', () => {});
    test('should assign unique identifier', () => {});
  });

  describe('Editing a document', () => {
    test('should track changes incrementally', () => {});
    test('should maintain undo/redo history', () => {});
    test('should auto-save periodically', () => {});
  });

  describe('Publishing a document', () => {
    test('should compile to final format', () => {});
    test('should generate preview', () => {});
    test('should update publication status', () => {});
  });
});
```

### 3. Grouping by User Role

```typescript
// tests/e2e/user-workflows.spec.ts

describe('Author Workflows', () => {
  test('should create and publish document', () => {});
  test('should collaborate with reviewers', () => {});
});

describe('Reviewer Workflows', () => {
  test('should comment on documents', () => {});
  test('should approve changes', () => {});
});

describe('Admin Workflows', () => {
  test('should manage user permissions', () => {});
  test('should configure system settings', () => {});
});
```

## Test Data Management

### 1. Inline Data (Simple Tests)

```typescript
test('should validate email format', () => {
  const valid = validateEmail('test@example.com');
  const invalid = validateEmail('not-an-email');

  expect(valid).toBe(true);
  expect(invalid).toBe(false);
});
```

### 2. Test Fixtures (Shared Data)

```typescript
// tests/fixtures/documents.ts
export const FIXTURES = {
  simple: {
    content: '# Hello\n\nWorld',
    metadata: { title: 'Simple Doc' }
  },
  complex: {
    content: readFileSync('fixtures/documents/complex.quail', 'utf-8'),
    metadata: { title: 'Complex Doc', version: 2 }
  }
};

// In tests:
import { FIXTURES } from '../fixtures/documents';

test('should parse simple document', () => {
  const ast = parse(FIXTURES.simple.content);
  expect(ast.type).toBe('Document');
});
```

### 3. Factory Pattern (Dynamic Data)

```typescript
// tests/factories/DocumentFactory.ts
export class DocumentFactory {
  private defaults = {
    id: () => `doc-${Date.now()}`,
    title: 'Untitled',
    content: '',
    createdAt: () => new Date(),
    author: 'test-user'
  };

  build(overrides = {}) {
    return {
      id: this.defaults.id(),
      title: this.defaults.title,
      content: this.defaults.content,
      createdAt: this.defaults.createdAt(),
      author: this.defaults.author,
      ...overrides
    };
  }

  buildList(count: number, overrides = {}) {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}

// In tests:
const documentFactory = new DocumentFactory();

test('should list user documents', () => {
  const docs = documentFactory.buildList(3, { author: 'alice' });
  const result = filterByAuthor(docs, 'alice');
  expect(result).toHaveLength(3);
});
```

### 4. Builders (Complex Objects)

```typescript
// tests/factories/CompilerOptionsBuilder.ts
export class CompilerOptionsBuilder {
  private options: CompilerOptions = {
    strictMode: false,
    sourceMap: false,
    plugins: []
  };

  withStrictMode() {
    this.options.strictMode = true;
    return this;
  }

  withSourceMaps() {
    this.options.sourceMap = true;
    return this;
  }

  withPlugin(plugin: Plugin) {
    this.options.plugins.push(plugin);
    return this;
  }

  build() {
    return { ...this.options };
  }
}

// In tests:
test('should apply strict mode validation', () => {
  const options = new CompilerOptionsBuilder()
    .withStrictMode()
    .withSourceMaps()
    .build();

  const result = compile(source, options);
  expect(result.errors).toHaveLength(0);
});
```

## Setup and Teardown Strategies

### 1. Per-Test Setup (Isolation)

```typescript
describe('Database operations', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDatabase();
    await db.migrate();
  });

  afterEach(async () => {
    await db.close();
    await cleanupTestDatabase(db);
  });

  test('should insert document', async () => {
    const doc = await db.documents.create({ title: 'Test' });
    expect(doc.id).toBeDefined();
  });
});
```

### 2. Per-Suite Setup (Shared Resources)

```typescript
describe('Compiler suite', () => {
  let compiler: Compiler;

  beforeAll(() => {
    compiler = new Compiler({
      // Expensive initialization
      plugins: loadAllPlugins(),
      grammar: parseGrammarFile()
    });
  });

  afterAll(() => {
    compiler.dispose();
  });

  test('should compile document 1', () => {
    const result = compiler.compile(doc1);
    expect(result.success).toBe(true);
  });

  test('should compile document 2', () => {
    const result = compiler.compile(doc2);
    expect(result.success).toBe(true);
  });
});
```

### 3. Global Setup (Test Environment)

```typescript
// tests/setup/jest.setup.ts
import { setupTestEnvironment } from '../utils/setup-test-env';

// Runs once before all test files
beforeAll(async () => {
  await setupTestEnvironment({
    database: 'test',
    clearCache: true,
    mockExternalServices: true
  });
});

// Configure custom matchers
expect.extend({
  toBeValidQuailDocument(received) {
    const pass = validateQuailDocument(received);
    return {
      pass,
      message: () => `Expected ${received} to be valid Quail document`
    };
  }
});
```

## Test Categorization

### Using Test Tags

```typescript
// Unit tests (default)
test('should validate input', () => {});

// Integration tests
test.integration('should connect to database', async () => {});

// E2E tests
test.e2e('should complete user workflow', async () => {});

// Slow tests
test.slow('should process large dataset', async () => {}, 30000);

// Flaky tests (to be fixed)
test.skip.flaky('should handle race condition', () => {});
```

### Running Specific Categories

```bash
# Run only unit tests
npm test -- --testPathPattern=".test.ts$"

# Run only integration tests
npm test -- --testPathPattern=".integration.test.ts$"

# Run only E2E tests
npm test -- --testPathPattern=".spec.ts$"

# Run fast tests only
npm test -- --testTimeout=1000

# Run specific suite
npm test -- Compiler.test.ts
```

## Test Configuration Files

### Jest Configuration

```typescript
// jest.config.js
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test matching
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  }
};
```

## Best Practices Summary

1. **Co-locate** unit tests with source code
2. **Centralize** integration and E2E tests
3. **Group** tests logically (feature, scenario, role)
4. **Use factories** for test data generation
5. **Isolate** tests with proper setup/teardown
6. **Tag** tests for selective execution
7. **Configure** test environments appropriately
8. **Document** complex test scenarios
9. **Maintain** test code quality like production code
10. **Review** and refactor tests regularly
