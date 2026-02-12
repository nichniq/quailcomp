# Declarative Test Patterns

This document focuses on **declarative testing** - describing *what* state you want rather than *how* to build it.

## Philosophy

### Procedural (Imperative) ❌

```typescript
test('should compile with plugins', () => {
  const compiler = new Compiler();
  compiler.setStrictMode(true);
  compiler.addPlugin(new ValidationPlugin());
  compiler.addPlugin(new TransformPlugin());
  compiler.setSourceMaps(true);

  const result = compiler.compile(source);
  expect(result.success).toBe(true);
});
```

### Declarative ✅

```typescript
test('should compile with plugins', () => {
  const result = compileWith(source, {
    strictMode: true,
    sourceMap: true,
    plugins: ['validation', 'transform']
  });

  expect(result.success).toBe(true);
});
```

## Pattern 1: Scenario Configurations

Define complete test scenarios as declarative configuration objects.

```typescript
// tests/utils/test-scenarios.ts

interface TestScenario {
  description: string;
  given: {
    document?: Partial<Document>;
    user?: Partial<User>;
    compiler?: Partial<CompilerOptions>;
    state?: Record<string, any>;
  };
  when: {
    action: string;
    params?: any;
  };
  then: {
    success?: boolean;
    errors?: string[];
    output?: any;
    state?: Record<string, any>;
  };
}

export async function runScenario(scenario: TestScenario) {
  // Setup phase - declaratively configure state
  const context = await setupContext(scenario.given);

  // Execute phase - perform action
  const result = await executeAction(context, scenario.when);

  // Assert phase - verify expectations
  verifyExpectations(result, scenario.then);

  return result;
}

// Usage in tests:
test('should compile valid document', async () => {
  await runScenario({
    description: 'compiling a valid document with strict mode',
    given: {
      document: { content: '# Hello World' },
      compiler: { strictMode: true, sourceMap: true }
    },
    when: {
      action: 'compile'
    },
    then: {
      success: true,
      output: { contains: '<h1>Hello World</h1>' }
    }
  });
});

test('should reject invalid document in strict mode', async () => {
  await runScenario({
    description: 'compiling invalid document with strict mode',
    given: {
      document: { content: '# \n\n' }, // Empty heading
      compiler: { strictMode: true }
    },
    when: {
      action: 'compile'
    },
    then: {
      success: false,
      errors: ['EMPTY_HEADING']
    }
  });
});
```

## Pattern 2: Fixture-Based State Setup

Use fixtures to declare complete application states.

```typescript
// tests/fixtures/states.ts

export const TEST_STATES = {
  // User states
  authenticatedUser: {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'author',
      authenticated: true
    },
    session: {
      token: 'valid-token',
      expiresAt: Date.now() + 3600000
    }
  },

  guestUser: {
    user: {
      id: null,
      authenticated: false
    },
    session: null
  },

  // Document states
  draftDocument: {
    document: {
      id: 'doc-1',
      title: 'Draft Document',
      content: '# Work in Progress',
      status: 'draft',
      author: 'user-1'
    }
  },

  publishedDocument: {
    document: {
      id: 'doc-2',
      title: 'Published Document',
      content: '# Complete',
      status: 'published',
      publishedAt: new Date('2025-01-01')
    }
  },

  // Compiler states
  strictCompiler: {
    compiler: {
      strictMode: true,
      validateLinks: true,
      validateImages: true,
      allowUnsafe: false
    }
  },

  permissiveCompiler: {
    compiler: {
      strictMode: false,
      allowUnsafe: true
    }
  },

  // Combined states
  authorEditingDraft: {
    ...TEST_STATES.authenticatedUser,
    ...TEST_STATES.draftDocument,
    editor: {
      mode: 'edit',
      autoSave: true,
      showPreview: true
    }
  }
};

// Helper to merge states
export function mergeStates(...states: any[]) {
  return states.reduce((acc, state) => ({ ...acc, ...state }), {});
}

// Usage in tests:
import { setupTestState } from '@tests/utils/state-setup';
import { TEST_STATES, mergeStates } from '@tests/fixtures/states';

test('should auto-save draft as authenticated user', async () => {
  const { editor, document } = await setupTestState(
    TEST_STATES.authorEditingDraft
  );

  await editor.type('New content');
  await waitFor(() => document.isDirty === false);

  expect(document.content).toContain('New content');
});

test('should compile with strict settings', async () => {
  const { compiler } = await setupTestState(
    mergeStates(
      TEST_STATES.strictCompiler,
      TEST_STATES.draftDocument
    )
  );

  const result = compiler.compile();
  expect(result.errors).toHaveLength(0);
});
```

## Pattern 3: Configuration Objects with Defaults

Create configuration objects that merge with sensible defaults.

```typescript
// tests/utils/setup-compiler.ts

interface CompilerTestConfig {
  mode?: 'strict' | 'permissive' | 'default';
  features?: {
    sourceMap?: boolean;
    validation?: boolean;
    transforms?: boolean;
  };
  plugins?: Array<string | { name: string; options: any }>;
  input?: {
    content?: string;
    file?: string;
    fixture?: string;
  };
  expect?: {
    success?: boolean;
    errorCodes?: string[];
    outputContains?: string[];
    outputMatches?: RegExp;
  };
}

const DEFAULT_CONFIG: CompilerTestConfig = {
  mode: 'default',
  features: {
    sourceMap: false,
    validation: true,
    transforms: true
  },
  plugins: [],
  input: {
    content: '# Default Content'
  }
};

export function testCompilation(config: CompilerTestConfig = {}) {
  const fullConfig = mergeDeep(DEFAULT_CONFIG, config);

  // Setup compiler based on declarative config
  const compilerOptions = buildOptionsFromConfig(fullConfig);
  const compiler = new Compiler(compilerOptions);

  // Get input based on declarative config
  const input = resolveInput(fullConfig.input);

  // Execute compilation
  const result = compiler.compile(input);

  // Auto-assert based on declarative expectations
  if (fullConfig.expect) {
    assertExpectations(result, fullConfig.expect);
  }

  return result;
}

// Usage - incredibly declarative:
test('should compile with validation', () => {
  testCompilation({
    mode: 'strict',
    input: { fixture: 'sample.quail' },
    expect: {
      success: true,
      outputContains: ['<h1>', '<p>']
    }
  });
});

test('should reject malformed input', () => {
  testCompilation({
    mode: 'strict',
    input: { fixture: 'malformed.quail' },
    expect: {
      success: false,
      errorCodes: ['SYNTAX_ERROR', 'UNCLOSED_DELIMITER']
    }
  });
});

test('should apply custom plugins', () => {
  testCompilation({
    plugins: [
      'validation',
      { name: 'transform', options: { level: 2 } }
    ],
    input: { content: '# Test' },
    expect: { success: true }
  });
});
```

## Pattern 4: Declarative Test Data with Traits

Use traits/tags to declaratively compose test data.

```typescript
// tests/factories/DocumentFactory.ts

type DocumentTrait =
  | 'draft'
  | 'published'
  | 'archived'
  | 'empty'
  | 'simple'
  | 'complex'
  | 'with-images'
  | 'with-code'
  | 'with-tables'
  | 'invalid'
  | 'malformed';

interface DocumentConfig {
  traits?: DocumentTrait[];
  overrides?: Partial<Document>;
}

const TRAIT_CONFIGS: Record<DocumentTrait, Partial<Document>> = {
  draft: {
    status: 'draft',
    publishedAt: undefined
  },
  published: {
    status: 'published',
    publishedAt: new Date()
  },
  archived: {
    status: 'archived',
    archivedAt: new Date()
  },
  empty: {
    content: '',
    wordCount: 0
  },
  simple: {
    content: '# Title\n\nSimple paragraph.',
    wordCount: 3
  },
  complex: {
    content: `# Main Title

## Section 1

Content with **bold** and *italic*.

\`\`\`javascript
const x = 42;
\`\`\`

- List item 1
- List item 2`,
    wordCount: 15
  },
  'with-images': {
    content: '# Title\n\n![Alt text](image.png)',
    hasImages: true
  },
  'with-code': {
    content: '# Title\n\n```js\ncode here\n```',
    hasCodeBlocks: true
  },
  'with-tables': {
    content: '# Title\n\n| A | B |\n|---|---|\n| 1 | 2 |',
    hasTables: true
  },
  invalid: {
    content: '# \n\n', // Empty heading
    isValid: false
  },
  malformed: {
    content: '```\nunclosed code fence',
    isValid: false
  }
};

export function createDocument(config: DocumentConfig = {}): Document {
  const { traits = ['simple'], overrides = {} } = config;

  // Start with base defaults
  let document: Document = {
    id: generateId(),
    title: 'Untitled',
    content: '',
    author: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft',
    tags: [],
    wordCount: 0
  };

  // Apply traits in order
  for (const trait of traits) {
    document = { ...document, ...TRAIT_CONFIGS[trait] };
  }

  // Apply overrides last
  document = { ...document, ...overrides };

  return document;
}

// Usage - highly declarative:
test('should compile simple published document', () => {
  const doc = createDocument({ traits: ['simple', 'published'] });

  const result = compile(doc.content);
  expect(result.success).toBe(true);
});

test('should handle complex documents with code', () => {
  const doc = createDocument({
    traits: ['complex', 'with-code', 'published'],
    overrides: { author: 'alice' }
  });

  expect(doc.hasCodeBlocks).toBe(true);
  expect(doc.status).toBe('published');
  expect(doc.author).toBe('alice');
});

test('should reject invalid documents', () => {
  const doc = createDocument({ traits: ['invalid'] });

  const result = compile(doc.content);
  expect(result.success).toBe(false);
});

// Even more declarative - batch testing:
const testCases = [
  { traits: ['simple'], shouldSucceed: true },
  { traits: ['complex', 'with-code'], shouldSucceed: true },
  { traits: ['with-images', 'with-tables'], shouldSucceed: true },
  { traits: ['invalid'], shouldSucceed: false },
  { traits: ['malformed'], shouldSucceed: false }
];

describe.each(testCases)('Document compilation', ({ traits, shouldSucceed }) => {
  test(`should ${shouldSucceed ? 'succeed' : 'fail'} for ${traits.join('+')}`, () => {
    const doc = createDocument({ traits });
    const result = compile(doc.content);
    expect(result.success).toBe(shouldSucceed);
  });
});
```

## Pattern 5: Declarative Component Testing

Declare component state and interactions as configuration.

```typescript
// tests/utils/component-test-utils.tsx

interface ComponentTestConfig<P = any> {
  component: React.ComponentType<P>;
  props?: P;
  state?: {
    user?: Partial<User>;
    theme?: 'light' | 'dark';
    editor?: Partial<EditorState>;
    [key: string]: any;
  };
  interactions?: Array<{
    type: 'click' | 'type' | 'select' | 'hover';
    target: string; // selector or aria label
    value?: any;
    wait?: number;
  }>;
  assertions?: Array<{
    type: 'visible' | 'contains' | 'hasValue' | 'hasAttribute';
    target: string;
    value?: any;
  }>;
}

export async function testComponent(config: ComponentTestConfig) {
  const { component: Component, props = {}, state = {}, interactions = [], assertions = [] } = config;

  // Declaratively set up providers based on state config
  const { user } = render(
    <Component {...props} />,
    { initialState: state }
  );

  // Execute interactions declaratively
  for (const interaction of interactions) {
    const element = screen.getByLabelText(interaction.target) ||
                    screen.getByRole(interaction.target);

    switch (interaction.type) {
      case 'click':
        await user.click(element);
        break;
      case 'type':
        await user.type(element, interaction.value);
        break;
      case 'select':
        await user.selectOptions(element, interaction.value);
        break;
      case 'hover':
        await user.hover(element);
        break;
    }

    if (interaction.wait) {
      await waitFor(() => {}, { timeout: interaction.wait });
    }
  }

  // Execute assertions declaratively
  for (const assertion of assertions) {
    const element = screen.getByLabelText(assertion.target) ||
                    screen.getByRole(assertion.target);

    switch (assertion.type) {
      case 'visible':
        expect(element).toBeVisible();
        break;
      case 'contains':
        expect(element).toHaveTextContent(assertion.value);
        break;
      case 'hasValue':
        expect(element).toHaveValue(assertion.value);
        break;
      case 'hasAttribute':
        expect(element).toHaveAttribute(assertion.value);
        break;
    }
  }
}

// Usage - pure declaration:
test('should edit and save document', async () => {
  await testComponent({
    component: QuailEditor,
    props: {
      initialContent: '# Hello'
    },
    state: {
      user: { authenticated: true, role: 'author' },
      editor: { autoSave: true }
    },
    interactions: [
      { type: 'type', target: 'textbox', value: ' World' },
      { type: 'click', target: 'Save', wait: 1000 }
    ],
    assertions: [
      { type: 'hasValue', target: 'textbox', value: '# Hello World' },
      { type: 'contains', target: 'status', value: 'Saved' }
    ]
  });
});
```

## Pattern 6: Table-Driven Tests

Use data tables to declare test cases.

```typescript
// Purely declarative test cases
const validationTests = [
  {
    description: 'valid email',
    input: 'user@example.com',
    expected: { valid: true }
  },
  {
    description: 'missing @',
    input: 'userexample.com',
    expected: { valid: false, error: 'INVALID_FORMAT' }
  },
  {
    description: 'missing domain',
    input: 'user@',
    expected: { valid: false, error: 'MISSING_DOMAIN' }
  },
  {
    description: 'empty string',
    input: '',
    expected: { valid: false, error: 'REQUIRED' }
  }
];

describe.each(validationTests)('Email validation', ({ description, input, expected }) => {
  test(description, () => {
    const result = validateEmail(input);
    expect(result).toEqual(expected);
  });
});

// More complex table-driven tests
const compilationTests = [
  {
    name: 'simple heading',
    config: {
      input: '# Hello',
      mode: 'default',
      expect: { success: true, contains: '<h1>Hello</h1>' }
    }
  },
  {
    name: 'code block',
    config: {
      input: '```js\nconst x = 1;\n```',
      mode: 'default',
      expect: { success: true, contains: '<code>' }
    }
  },
  {
    name: 'invalid in strict mode',
    config: {
      input: '# ',
      mode: 'strict',
      expect: { success: false, errorCodes: ['EMPTY_HEADING'] }
    }
  }
];

describe.each(compilationTests)('Compilation: $name', ({ config }) => {
  test('should compile correctly', () => {
    testCompilation(config);
  });
});
```

## Pattern 7: Declarative Setup with Snapshots

Combine declarative state with snapshot testing.

```typescript
// tests/snapshots/scenarios.ts

export const SNAPSHOT_SCENARIOS = {
  'simple-document': {
    state: { document: { content: '# Hello\n\nWorld' } },
    compile: true,
    snapshots: ['ast', 'html', 'metadata']
  },

  'complex-document': {
    state: {
      document: { content: FixtureLoader.loadQuail('complex') },
      compiler: { strictMode: true, sourceMap: true }
    },
    compile: true,
    snapshots: ['ast', 'html', 'sourceMap']
  },

  'error-recovery': {
    state: {
      document: { content: '```\nunclosed' },
      compiler: { strictMode: false }
    },
    compile: true,
    snapshots: ['errors', 'partialAst']
  }
};

// Usage:
describe('Snapshot tests', () => {
  Object.entries(SNAPSHOT_SCENARIOS).forEach(([name, scenario]) => {
    test(name, () => {
      const result = runWithState(scenario.state, () => {
        if (scenario.compile) {
          return compile(scenario.state.document.content, scenario.state.compiler);
        }
      });

      scenario.snapshots.forEach(snapshotType => {
        expect(result[snapshotType]).toMatchSnapshot(snapshotType);
      });
    });
  });
});
```

## Benefits of Declarative Testing

1. **Readability**: Tests read like specifications
2. **Reusability**: Configurations can be composed and shared
3. **Maintainability**: Change behavior in one place
4. **Discoverability**: Easy to see all possible states
5. **Consistency**: Same patterns across all tests
6. **Reduced boilerplate**: Less setup code in each test
7. **Type safety**: Configurations can be strongly typed
8. **Documentation**: Config objects document test intent

## Migration Path

### Before (Procedural)

```typescript
test('complex test', async () => {
  const db = await createDatabase();
  await db.migrate();
  const user = await db.users.create({ email: 'test@example.com' });
  const session = await createSession(user);
  const compiler = new Compiler();
  compiler.setStrictMode(true);
  const doc = await db.documents.create({ author: user.id });

  const result = await compiler.compile(doc.content);

  expect(result.success).toBe(true);
  await db.close();
});
```

### After (Declarative)

```typescript
test('complex test', async () => {
  await runScenario({
    given: {
      user: { email: 'test@example.com', authenticated: true },
      document: { status: 'draft' },
      compiler: { strictMode: true }
    },
    when: { action: 'compile' },
    then: { success: true }
  });
});
```

The declarative approach makes tests shorter, clearer, and more maintainable while preserving (or improving) their expressiveness.
