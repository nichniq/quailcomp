# Example Tests for Quail Compiler

This document shows concrete examples of well-written tests for different layers of the Quail compiler system.

## Unit Test Examples

### 1. Pure Function Testing

```typescript
// src/core/utils/string-utils.test.ts
import { escapeHTML, truncate, slugify } from './string-utils';

describe('String Utilities', () => {
  describe('escapeHTML', () => {
    test('should escape HTML special characters', () => {
      expect(escapeHTML('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('should handle empty string', () => {
      expect(escapeHTML('')).toBe('');
    });

    test('should not escape safe characters', () => {
      expect(escapeHTML('Hello World 123')).toBe('Hello World 123');
    });

    test('should escape all instances', () => {
      expect(escapeHTML('< > < >')).toBe('&lt; &gt; &lt; &gt;');
    });
  });

  describe('truncate', () => {
    test('should truncate long strings', () => {
      expect(truncate('Hello World', 5)).toBe('Hello...');
    });

    test('should not truncate short strings', () => {
      expect(truncate('Hi', 5)).toBe('Hi');
    });

    test('should use custom suffix', () => {
      expect(truncate('Hello World', 5, ' →')).toBe('Hello →');
    });

    test('should handle edge case at exact length', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });
  });

  describe('slugify', () => {
    test('should convert to lowercase', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    test('should replace spaces with hyphens', () => {
      expect(slugify('foo bar baz')).toBe('foo-bar-baz');
    });

    test('should remove special characters', () => {
      expect(slugify('Hello! @World#')).toBe('hello-world');
    });

    test('should handle multiple consecutive spaces', () => {
      expect(slugify('hello    world')).toBe('hello-world');
    });

    test('should trim leading and trailing hyphens', () => {
      expect(slugify('  hello world  ')).toBe('hello-world');
    });
  });
});
```

### 2. Class Method Testing

```typescript
// src/core/compiler/Lexer.test.ts
import { Lexer } from './Lexer';
import { TokenType } from './types';

describe('Lexer', () => {
  let lexer: Lexer;

  beforeEach(() => {
    lexer = new Lexer();
  });

  describe('tokenize', () => {
    test('should tokenize simple heading', () => {
      const tokens = lexer.tokenize('# Hello');

      expect(tokens).toEqual([
        { type: TokenType.HEADING, value: '#', level: 1, position: 0 },
        { type: TokenType.WHITESPACE, value: ' ', position: 1 },
        { type: TokenType.TEXT, value: 'Hello', position: 2 }
      ]);
    });

    test('should handle multiple heading levels', () => {
      const tokens = lexer.tokenize('### Level 3');

      expect(tokens[0]).toMatchObject({
        type: TokenType.HEADING,
        level: 3
      });
    });

    test('should tokenize code blocks', () => {
      const input = '```js\nconst x = 1;\n```';
      const tokens = lexer.tokenize(input);

      expect(tokens).toContainWhere(
        t => t.type === TokenType.CODE_FENCE_START
      );
      expect(tokens).toContainWhere(
        t => t.type === TokenType.CODE_FENCE_END
      );
    });

    test('should handle empty input', () => {
      const tokens = lexer.tokenize('');
      expect(tokens).toEqual([]);
    });

    test('should preserve position information', () => {
      const tokens = lexer.tokenize('Hello\nWorld');

      expect(tokens[0].position).toBe(0);
      expect(tokens[1].position).toBe(5); // After "Hello"
      expect(tokens[2].position).toBe(6); // After newline
    });
  });

  describe('error handling', () => {
    test('should report unclosed code fence', () => {
      expect(() => lexer.tokenize('```\ncode'))
        .toThrow('Unclosed code fence');
    });

    test('should report invalid escape sequence', () => {
      expect(() => lexer.tokenize('\\q'))
        .toThrow('Invalid escape sequence');
    });
  });
});
```

### 3. AST Transformation Testing

```typescript
// src/core/compiler/Parser.test.ts
import { Parser } from './Parser';
import { ASTFactory } from '@tests/factories/ASTFactory';

describe('Parser', () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
  });

  describe('parse', () => {
    test('should parse heading', () => {
      const ast = parser.parse('# Hello World');

      expect(ast).toMatchASTNode({
        type: 'Document',
        children: [
          {
            type: 'Heading',
            level: 1,
            children: [{ type: 'Text', value: 'Hello World' }]
          }
        ]
      });
    });

    test('should parse nested lists', () => {
      const input = `
- Item 1
  - Nested 1
  - Nested 2
- Item 2
      `.trim();

      const ast = parser.parse(input);
      const list = ast.children[0];

      expect(list.type).toBe('List');
      expect(list.children).toHaveLength(2);
      expect(list.children[0].children[0].children).toHaveLength(2);
    });

    test('should parse inline formatting', () => {
      const ast = parser.parse('**bold** and *italic*');

      const paragraph = ast.children[0];
      expect(paragraph.children).toEqual([
        { type: 'Strong', children: [{ type: 'Text', value: 'bold' }] },
        { type: 'Text', value: ' and ' },
        { type: 'Emphasis', children: [{ type: 'Text', value: 'italic' }] }
      ]);
    });

    test('should handle complex document', () => {
      const input = `
# Title

This is a paragraph with **bold** text.

\`\`\`javascript
const x = 42;
\`\`\`

- List item 1
- List item 2
      `.trim();

      const ast = parser.parse(input);

      expect(ast.children).toHaveLength(4); // heading, para, code, list
      expect(ast.children[0].type).toBe('Heading');
      expect(ast.children[1].type).toBe('Paragraph');
      expect(ast.children[2].type).toBe('CodeBlock');
      expect(ast.children[3].type).toBe('List');
    });
  });

  describe('error recovery', () => {
    test('should collect multiple errors', () => {
      const result = parser.parse('**unclosed\n\n*another unclosed');

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toHaveErrorCode('UNCLOSED_DELIMITER');
      expect(result.errors[1]).toHaveErrorCode('UNCLOSED_DELIMITER');
    });

    test('should continue parsing after error', () => {
      const result = parser.parse('**bad\n\n# Good Heading');

      expect(result.errors).toHaveLength(1);
      expect(result.ast.children).toContainWhere(
        node => node.type === 'Heading'
      );
    });
  });
});
```

## Integration Test Examples

### 4. End-to-End Compilation

```typescript
// tests/integration/compilation.test.ts
import { Compiler } from '@/core/compiler/Compiler';
import { CompilerOptionsBuilder } from '@tests/factories/CompilerOptionsBuilder';
import { FixtureLoader } from '@tests/factories/FixtureLoader';

describe('Document Compilation', () => {
  let compiler: Compiler;

  beforeEach(() => {
    const options = CompilerOptionsBuilder.default().build();
    compiler = new Compiler(options);
  });

  test('should compile simple document to HTML', () => {
    const source = '# Hello\n\nWorld';
    const result = compiler.compile(source);

    expect(result.success).toBe(true);
    expect(result.output).toContain('<h1>Hello</h1>');
    expect(result.output).toContain('<p>World</p>');
  });

  test('should compile with source maps', () => {
    const options = CompilerOptionsBuilder.default()
      .withSourceMaps()
      .build();

    compiler = new Compiler(options);
    const result = compiler.compile('# Test');

    expect(result.sourceMap).toBeDefined();
    expect(result.sourceMap.mappings).toBeTruthy();
  });

  test('should apply transformations in order', () => {
    const mockTransformer = {
      name: 'test',
      transform: jest.fn(ast => ast)
    };

    const options = CompilerOptionsBuilder.default()
      .addTransformer(mockTransformer)
      .build();

    compiler = new Compiler(options);
    compiler.compile('# Test');

    expect(mockTransformer.transform).toHaveBeenCalled();
  });

  test('should handle complex real-world document', () => {
    const source = FixtureLoader.loadQuail('complex');
    const result = compiler.compile(source);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.output).toMatchSnapshot();
  });

  test('should validate in strict mode', () => {
    const options = CompilerOptionsBuilder.default()
      .strictMode()
      .build();

    compiler = new Compiler(options);
    const result = compiler.compile('# \n\n'); // Empty heading

    expect(result.success).toBe(false);
    expect(result.errors[0]).toHaveErrorCode('EMPTY_HEADING');
  });
});
```

### 5. API Integration Testing

```typescript
// tests/integration/api/compiler-api.test.ts
import request from 'supertest';
import { app } from '@/server/app';
import { DocumentFactory } from '@tests/factories/DocumentFactory';

describe('Compiler API', () => {
  describe('POST /api/compile', () => {
    test('should compile document and return HTML', async () => {
      const response = await request(app)
        .post('/api/compile')
        .send({
          source: '# Hello World',
          options: { format: 'html' }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        output: expect.stringContaining('<h1>Hello World</h1>')
      });
    });

    test('should return errors for invalid input', async () => {
      const response = await request(app)
        .post('/api/compile')
        .send({
          source: '```\nunclosed',
          options: { strictMode: true }
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toHaveLength(1);
    });

    test('should respect rate limiting', async () => {
      const requests = Array(101).fill(null).map(() =>
        request(app)
          .post('/api/compile')
          .send({ source: '# Test' })
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });

    test('should handle large documents', async () => {
      const largeDoc = '# Heading\n\n' + 'Lorem ipsum. '.repeat(10000);

      const response = await request(app)
        .post('/api/compile')
        .send({ source: largeDoc })
        .expect(200);

      expect(response.body.success).toBe(true);
    }, 10000); // 10 second timeout
  });
});
```

## Component Test Examples

### 6. React Component Testing

```typescript
// src/components/QuailEditor/QuailEditor.test.tsx
import { render, screen, userEvent } from '@tests/utils/render';
import { QuailEditor } from './QuailEditor';
import { DocumentFactory } from '@tests/factories/DocumentFactory';

describe('QuailEditor', () => {
  test('should render with initial content', () => {
    const document = DocumentFactory.createWithContent('# Hello');

    render(<QuailEditor document={document} />);

    expect(screen.getByRole('textbox')).toHaveValue('# Hello');
  });

  test('should update content on typing', async () => {
    const document = DocumentFactory.create();
    const onChange = jest.fn();

    render(<QuailEditor document={document} onChange={onChange} />);

    const editor = screen.getByRole('textbox');
    await userEvent.type(editor, 'Hello');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Hello'
      })
    );
  });

  test('should show preview when enabled', () => {
    const document = DocumentFactory.createWithContent('# Title');

    render(<QuailEditor document={document} showPreview />);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Title').tagName).toBe('H1');
  });

  test('should highlight syntax errors', async () => {
    const document = DocumentFactory.create();

    render(<QuailEditor document={document} validateOnChange />);

    const editor = screen.getByRole('textbox');
    await userEvent.type(editor, '```\nunclosed');

    expect(await screen.findByText(/unclosed code fence/i))
      .toBeInTheDocument();
  });

  test('should support undo/redo', async () => {
    const document = DocumentFactory.create();

    render(<QuailEditor document={document} />);

    const editor = screen.getByRole('textbox');
    await userEvent.type(editor, 'Hello');
    await userEvent.type(editor, ' World');

    // Undo
    await userEvent.keyboard('{Meta>}z{/Meta}');
    expect(editor).toHaveValue('Hello');

    // Redo
    await userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(editor).toHaveValue('Hello World');
  });
});
```

### 7. Custom Hook Testing

```typescript
// src/components/QuailEditor/hooks/useQuailState.test.ts
import { renderHook, act } from '@testing-library/react';
import { useQuailState } from './useQuailState';

describe('useQuailState', () => {
  test('should initialize with default state', () => {
    const { result } = renderHook(() => useQuailState());

    expect(result.current.content).toBe('');
    expect(result.current.isDirty).toBe(false);
  });

  test('should update content', () => {
    const { result } = renderHook(() => useQuailState());

    act(() => {
      result.current.setContent('# Hello');
    });

    expect(result.current.content).toBe('# Hello');
    expect(result.current.isDirty).toBe(true);
  });

  test('should track history', () => {
    const { result } = renderHook(() => useQuailState());

    act(() => {
      result.current.setContent('First');
      result.current.setContent('Second');
      result.current.setContent('Third');
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.content).toBe('Second');
  });

  test('should debounce auto-save', async () => {
    jest.useFakeTimers();
    const onSave = jest.fn();

    const { result } = renderHook(() =>
      useQuailState({ autoSave: true, onSave })
    );

    act(() => {
      result.current.setContent('A');
      result.current.setContent('AB');
      result.current.setContent('ABC');
    });

    expect(onSave).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('ABC');

    jest.useRealTimers();
  });
});
```

## Snapshot Testing

### 8. AST and Output Snapshots

```typescript
// tests/integration/snapshots.test.ts
import { Compiler } from '@/core/compiler/Compiler';
import { FixtureLoader } from '@tests/factories/FixtureLoader';

describe('Compilation Snapshots', () => {
  const compiler = new Compiler();

  test('should match AST snapshot for sample document', () => {
    const source = FixtureLoader.loadQuail('sample');
    const result = compiler.compile(source);

    expect(result.ast).toMatchSnapshot();
  });

  test('should match HTML output snapshot', () => {
    const source = FixtureLoader.loadQuail('sample');
    const result = compiler.compile(source);

    expect(result.output).toMatchSnapshot();
  });

  test('should match error messages snapshot', () => {
    const source = FixtureLoader.loadQuail('malformed');
    const result = compiler.compile(source);

    expect(result.errors).toMatchSnapshot();
  });
});
```

These examples demonstrate best practices for testing at different levels of the application, from pure functions to full integration tests.
