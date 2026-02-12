# Test Utilities and Factory Patterns

## Custom Test Utilities

### 1. Rendering Utilities (React Components)

```typescript
// tests/utils/render.tsx
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { QuailProvider } from '@/contexts/QuailContext';
import { ThemeProvider } from '@/contexts/ThemeProvider';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Partial<QuailState>;
  theme?: 'light' | 'dark';
}

export function render(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { initialState, theme = 'light', ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider initialTheme={theme}>
        <QuailProvider initialState={initialState}>
          {children}
        </QuailProvider>
      </ThemeProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything
export * from '@testing-library/react';

// Usage:
import { render, screen } from '@tests/utils/render';

test('should render editor with custom theme', () => {
  render(<QuailEditor />, { theme: 'dark' });
  expect(screen.getByRole('textbox')).toBeInTheDocument();
});
```

### 2. Async Utilities

```typescript
// tests/utils/async.ts

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await sleep(interval);
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 100
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }
  }

  throw lastError!;
}

// Usage:
test('should eventually update status', async () => {
  const result = await retry(() => checkStatus(), 3, 100);
  expect(result).toBe('completed');
});
```

### 3. Mock Utilities

```typescript
// tests/utils/mocks.ts

/**
 * Create a mock function with typed return value
 */
export function createMock<T extends (...args: any[]) => any>(
  implementation?: T
): jest.MockedFunction<T> {
  return jest.fn(implementation) as jest.MockedFunction<T>;
}

/**
 * Create a partial mock of an object
 */
export function createPartialMock<T extends object>(
  partial: Partial<T>
): T {
  return partial as T;
}

/**
 * Mock localStorage
 */
export function mockLocalStorage() {
  const store: Record<string, string> = {};

  const mock = {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    })
  };

  Object.defineProperty(window, 'localStorage', {
    value: mock,
    writable: true
  });

  return mock;
}

/**
 * Mock fetch API
 */
export function mockFetch(responses: Record<string, any>) {
  global.fetch = jest.fn((url: string) => {
    const response = responses[url];

    if (!response) {
      return Promise.reject(new Error(`No mock for ${url}`));
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response)
    });
  }) as jest.Mock;

  return global.fetch as jest.Mock;
}

// Usage:
test('should fetch user data', async () => {
  mockFetch({
    '/api/user/123': { id: 123, name: 'Alice' }
  });

  const user = await fetchUser(123);
  expect(user.name).toBe('Alice');
});
```

### 4. Custom Matchers

```typescript
// tests/utils/custom-matchers.ts

expect.extend({
  /**
   * Check if AST node matches expected structure
   */
  toMatchASTNode(received: ASTNode, expected: Partial<ASTNode>) {
    const pass = Object.entries(expected).every(
      ([key, value]) => received[key] === value
    );

    return {
      pass,
      message: () =>
        pass
          ? `Expected AST node not to match ${JSON.stringify(expected)}`
          : `Expected AST node to match ${JSON.stringify(expected)}, got ${JSON.stringify(received)}`
    };
  },

  /**
   * Check if error has specific code
   */
  toHaveErrorCode(received: CompilerError, code: string) {
    const pass = received.code === code;

    return {
      pass,
      message: () =>
        pass
          ? `Expected error not to have code ${code}`
          : `Expected error to have code ${code}, got ${received.code}`
    };
  },

  /**
   * Check if array contains items matching predicate
   */
  toContainWhere<T>(received: T[], predicate: (item: T) => boolean) {
    const pass = received.some(predicate);

    return {
      pass,
      message: () =>
        pass
          ? 'Expected array not to contain matching item'
          : 'Expected array to contain matching item'
    };
  }
});

// Usage:
test('should generate valid AST', () => {
  const ast = parse('# Hello');
  expect(ast).toMatchASTNode({ type: 'Document' });
});

test('should report syntax error', () => {
  const result = compile('invalid {{');
  expect(result.errors[0]).toHaveErrorCode('SYNTAX_ERROR');
});
```

## Factory Patterns

### 1. Simple Factory

```typescript
// tests/factories/DocumentFactory.ts

export class DocumentFactory {
  private static counter = 0;

  static create(overrides: Partial<Document> = {}): Document {
    const id = `doc-${++this.counter}`;

    return {
      id,
      title: `Document ${id}`,
      content: '',
      author: 'test-user',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
      tags: [],
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<Document> = {}): Document[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createPublished(overrides: Partial<Document> = {}): Document {
    return this.create({
      status: 'published',
      publishedAt: new Date(),
      ...overrides
    });
  }

  static createWithContent(content: string, overrides: Partial<Document> = {}): Document {
    return this.create({
      content,
      wordCount: content.split(/\s+/).length,
      ...overrides
    });
  }

  static reset() {
    this.counter = 0;
  }
}

// Usage:
test('should filter published documents', () => {
  const docs = [
    DocumentFactory.createPublished(),
    DocumentFactory.create({ status: 'draft' }),
    DocumentFactory.createPublished()
  ];

  const published = filterByStatus(docs, 'published');
  expect(published).toHaveLength(2);
});
```

### 2. Builder Pattern

```typescript
// tests/factories/CompilerOptionsBuilder.ts

export class CompilerOptionsBuilder {
  private options: CompilerOptions = {
    strictMode: false,
    sourceMap: false,
    target: 'es5',
    plugins: [],
    transformers: [],
    output: {
      format: 'html',
      minify: false
    }
  };

  strictMode(enabled = true): this {
    this.options.strictMode = enabled;
    return this;
  }

  withSourceMaps(): this {
    this.options.sourceMap = true;
    return this;
  }

  target(target: 'es5' | 'es6' | 'esnext'): this {
    this.options.target = target;
    return this;
  }

  addPlugin(plugin: Plugin): this {
    this.options.plugins.push(plugin);
    return this;
  }

  addTransformer(transformer: Transformer): this {
    this.options.transformers.push(transformer);
    return this;
  }

  outputFormat(format: 'html' | 'markdown' | 'json'): this {
    this.options.output.format = format;
    return this;
  }

  minify(): this {
    this.options.output.minify = true;
    return this;
  }

  build(): CompilerOptions {
    return { ...this.options };
  }

  static default(): CompilerOptionsBuilder {
    return new CompilerOptionsBuilder();
  }

  static production(): CompilerOptionsBuilder {
    return new CompilerOptionsBuilder()
      .strictMode()
      .minify()
      .target('esnext');
  }
}

// Usage:
test('should compile with custom options', () => {
  const options = CompilerOptionsBuilder.default()
    .strictMode()
    .withSourceMaps()
    .addPlugin(new ValidationPlugin())
    .build();

  const result = compile(source, options);
  expect(result.sourceMap).toBeDefined();
});
```

### 3. Abstract Factory

```typescript
// tests/factories/ASTFactory.ts

export class ASTFactory {
  static document(children: ASTNode[] = []): DocumentNode {
    return {
      type: 'Document',
      children,
      position: { start: 0, end: 0 }
    };
  }

  static heading(level: number, text: string): HeadingNode {
    return {
      type: 'Heading',
      level,
      children: [this.text(text)],
      position: { start: 0, end: text.length }
    };
  }

  static paragraph(children: ASTNode[]): ParagraphNode {
    return {
      type: 'Paragraph',
      children,
      position: { start: 0, end: 0 }
    };
  }

  static text(value: string): TextNode {
    return {
      type: 'Text',
      value,
      position: { start: 0, end: value.length }
    };
  }

  static codeBlock(code: string, language = 'javascript'): CodeBlockNode {
    return {
      type: 'CodeBlock',
      language,
      value: code,
      position: { start: 0, end: code.length }
    };
  }

  static list(items: string[], ordered = false): ListNode {
    return {
      type: 'List',
      ordered,
      children: items.map(item => ({
        type: 'ListItem',
        children: [this.paragraph([this.text(item)])]
      })),
      position: { start: 0, end: 0 }
    };
  }

  // Composite factories
  static simpleDocument(): DocumentNode {
    return this.document([
      this.heading(1, 'Title'),
      this.paragraph([this.text('Hello world')])
    ]);
  }

  static complexDocument(): DocumentNode {
    return this.document([
      this.heading(1, 'Main Title'),
      this.paragraph([
        this.text('This is a paragraph with '),
        { type: 'Strong', children: [this.text('bold text')] },
        this.text('.')
      ]),
      this.codeBlock('const x = 42;', 'javascript'),
      this.list(['Item 1', 'Item 2', 'Item 3'])
    ]);
  }
}

// Usage:
test('should transform document', () => {
  const ast = ASTFactory.simpleDocument();
  const html = transformToHTML(ast);

  expect(html).toContain('<h1>Title</h1>');
  expect(html).toContain('<p>Hello world</p>');
});
```

### 4. Fixture Loader

```typescript
// tests/factories/FixtureLoader.ts
import { readFileSync } from 'fs';
import { join } from 'path';

export class FixtureLoader {
  private static readonly FIXTURES_DIR = join(__dirname, '../fixtures');
  private static cache = new Map<string, any>();

  static load<T = string>(path: string, parse = false): T {
    const cacheKey = `${path}:${parse}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const fullPath = join(this.FIXTURES_DIR, path);
    const content = readFileSync(fullPath, 'utf-8');

    const result = parse ? JSON.parse(content) : content;
    this.cache.set(cacheKey, result);

    return result;
  }

  static loadQuail(filename: string): string {
    return this.load(`documents/${filename}.quail`);
  }

  static loadJSON<T>(filename: string): T {
    return this.load(`${filename}.json`, true);
  }

  static loadMultiple(pattern: string): string[] {
    // Implementation would use glob to match pattern
    return [];
  }

  static clearCache() {
    this.cache.clear();
  }
}

// Usage:
test('should parse fixture document', () => {
  const content = FixtureLoader.loadQuail('sample');
  const ast = parse(content);
  expect(ast.type).toBe('Document');
});

test('should match snapshot', () => {
  const config = FixtureLoader.loadJSON('compiler-config');
  expect(config).toMatchSnapshot();
});
```

### 5. Test Data Generator

```typescript
// tests/factories/DataGenerator.ts

export class DataGenerator {
  private static readonly LOREM = 'Lorem ipsum dolor sit amet...';

  static id(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static email(name = 'user'): string {
    return `${name}-${this.id()}@example.com`;
  }

  static name(): string {
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    return names[Math.floor(Math.random() * names.length)];
  }

  static sentence(words = 10): string {
    const allWords = this.LOREM.toLowerCase().split(/\s+/);
    const selected = Array.from(
      { length: words },
      () => allWords[Math.floor(Math.random() * allWords.length)]
    );
    return selected.join(' ') + '.';
  }

  static paragraph(sentences = 5): string {
    return Array.from(
      { length: sentences },
      () => this.sentence(8)
    ).join(' ');
  }

  static timestamp(offset = 0): Date {
    return new Date(Date.now() + offset);
  }

  static integer(min = 0, max = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static boolean(): boolean {
    return Math.random() > 0.5;
  }

  static arrayOf<T>(generator: () => T, count = 5): T[] {
    return Array.from({ length: count }, generator);
  }
}

// Usage:
test('should handle random data', () => {
  const user = {
    id: DataGenerator.id(),
    name: DataGenerator.name(),
    email: DataGenerator.email(),
    bio: DataGenerator.paragraph(3),
    createdAt: DataGenerator.timestamp(-86400000) // 1 day ago
  };

  expect(validateUser(user)).toBe(true);
});
```

## Integration Examples

### Complete Test with Utilities

```typescript
// tests/integration/document-editing.test.ts
import { render, screen, userEvent } from '@tests/utils/render';
import { DocumentFactory } from '@tests/factories/DocumentFactory';
import { mockLocalStorage } from '@tests/utils/mocks';
import { waitFor } from '@tests/utils/async';

describe('Document Editing', () => {
  beforeEach(() => {
    mockLocalStorage();
    DocumentFactory.reset();
  });

  test('should save document on edit', async () => {
    const document = DocumentFactory.create({
      title: 'My Document',
      content: 'Initial content'
    });

    render(<DocumentEditor document={document} />);

    const editor = screen.getByRole('textbox');
    await userEvent.type(editor, ' and more');

    await waitFor(() => {
      const saved = localStorage.getItem(`doc-${document.id}`);
      return saved?.includes('and more') ?? false;
    });

    expect(localStorage.getItem(`doc-${document.id}`)).toContain('and more');
  });
});
```

This comprehensive set of utilities and factories provides the foundation for writing maintainable, readable, and powerful tests throughout your codebase.
