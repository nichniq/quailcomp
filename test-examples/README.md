# Test Examples & Strategy Documentation

This directory contains comprehensive examples and documentation for implementing a world-class testing strategy for the Quail compiler project.

## Contents

### 📋 Strategy Documents

1. **[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)** - Core testing philosophy and principles
   - Test behavior, not implementation
   - Testing pyramid (unit, integration, E2E)
   - Code coverage guidelines
   - Mocking strategies
   - Anti-patterns to avoid

2. **[TEST_ORGANIZATION.md](./TEST_ORGANIZATION.md)** - How to structure and organize tests
   - File structure (co-located vs centralized)
   - Test suite organization patterns
   - Setup/teardown strategies
   - Test categorization and tagging
   - Configuration examples

3. **[UTILITIES_AND_FACTORIES.md](./UTILITIES_AND_FACTORIES.md)** - Reusable test infrastructure
   - Custom rendering utilities
   - Async testing helpers
   - Mock utilities
   - Factory patterns (simple, builder, abstract)
   - Test data generators

4. **[EXAMPLE_TESTS.md](./EXAMPLE_TESTS.md)** - Concrete test examples
   - Unit test examples (pure functions, classes, transformations)
   - Integration test examples (API, compilation)
   - Component test examples (React, hooks)
   - Snapshot testing examples

## Key Principles

### 1. Test Behavior, Not Implementation

Focus on what your code does, not how it does it. Tests should remain stable when you refactor implementation details.

### 2. The Testing Pyramid

- **60-75% Unit Tests**: Fast, isolated, focused
- **20-30% Integration Tests**: Verify components work together
- **5-10% E2E Tests**: Critical user workflows only

### 3. Optimize for Readability

Tests are documentation. Prioritize clarity over DRY principles. A test should tell a story.

### 4. Fast Feedback Loops

- Unit tests: < 1 second per suite
- Integration tests: < 10 seconds per suite
- E2E tests: < 5 minutes for full suite

### 5. Isolation & Independence

Each test should run in any order, not depend on others, and clean up its own state.

## Quick Start Examples

### Simple Unit Test

```typescript
import { escapeHTML } from './string-utils';

test('should escape HTML special characters', () => {
  expect(escapeHTML('<script>alert("xss")</script>'))
    .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
});
```

### Using Factories

```typescript
import { DocumentFactory } from '@tests/factories/DocumentFactory';

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

### Integration Test

```typescript
import { Compiler } from '@/core/compiler/Compiler';

test('should compile simple document to HTML', () => {
  const compiler = new Compiler();
  const result = compiler.compile('# Hello\n\nWorld');

  expect(result.success).toBe(true);
  expect(result.output).toContain('<h1>Hello</h1>');
  expect(result.output).toContain('<p>World</p>');
});
```

### Component Test

```typescript
import { render, screen } from '@tests/utils/render';
import { QuailEditor } from './QuailEditor';

test('should render with initial content', () => {
  render(<QuailEditor initialContent="# Hello" />);
  expect(screen.getByRole('textbox')).toHaveValue('# Hello');
});
```

## Recommended Implementation Path

When implementing this testing strategy in the Quail compiler project:

### Phase 1: Foundation (Week 1-2)

1. Set up test infrastructure
   - Configure Jest/Vitest
   - Create basic directory structure
   - Set up test utilities

2. Implement core factories
   - DocumentFactory
   - ASTFactory
   - CompilerOptionsBuilder

3. Write custom matchers
   - toMatchASTNode
   - toHaveErrorCode

### Phase 2: Unit Tests (Week 2-4)

1. Test utilities and helpers
   - String utilities
   - Validation functions
   - Data transformations

2. Test core compiler components
   - Lexer
   - Parser
   - Transformers

3. Aim for 80% coverage on core logic

### Phase 3: Integration Tests (Week 4-6)

1. End-to-end compilation tests
2. API endpoint tests
3. Database integration tests
4. File system operations

### Phase 4: Component Tests (Week 6-8)

1. React component tests
2. Custom hooks tests
3. Context providers
4. UI interactions

### Phase 5: E2E Tests (Week 8-10)

1. Critical user workflows
2. Document lifecycle
3. Authentication flows
4. Error scenarios

## Tools & Libraries

### Core Testing

- **Jest** or **Vitest**: Test runner and framework
- **@testing-library/react**: React component testing
- **@testing-library/user-event**: User interaction simulation

### Utilities

- **supertest**: HTTP API testing
- **msw**: API mocking
- **faker**: Test data generation (optional)

### Quality

- **eslint-plugin-testing-library**: Lint rules for tests
- **eslint-plugin-jest**: Jest-specific linting

## Measuring Success

### Quantitative Metrics

- **Code Coverage**: 80% minimum
- **Test Execution Time**: < 2 minutes for unit tests
- **Flaky Test Rate**: < 1%
- **Test to Code Ratio**: 1:1 to 2:1

### Qualitative Metrics

- Tests as documentation: Can new developers understand the system by reading tests?
- Refactoring confidence: Can you refactor without breaking tests?
- Bug detection: Do tests catch regressions before production?

## Resources

### Books

- *Test Driven Development* by Kent Beck
- *Growing Object-Oriented Software, Guided by Tests* by Steve Freeman
- *Working Effectively with Legacy Code* by Michael Feathers

### Articles

- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles/)
- [Kent Beck's Test Desiderata](https://kentbeck.github.io/TestDesiderata/)
- [Martin Fowler on Test Pyramids](https://martinfowler.com/articles/practical-test-pyramid.html)

### Videos

- [Integration Tests Are a Scam](https://www.youtube.com/watch?v=VDfX44fZoMc) by J.B. Rainsberger
- [The Clean Code Talks](https://www.youtube.com/watch?v=wEhu57pih5w) by Miško Hevery

---

**Note**: These examples represent testing ideals and best practices. They can be adapted to fit the specific needs of the Quail compiler project while maintaining the core principles of good testing.
