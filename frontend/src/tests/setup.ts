/**
 * Vitest setup file
 *
 * Runs before all tests to configure the testing environment.
 */

import { vi, beforeEach } from 'vitest';
import { config } from '@vue/test-utils';

// Mock window.matchMedia (not implemented in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// localStorage is mocked by vitest-localstorage-mock (configured in vitest.config.ts)

// Suppress Vue warnings in tests
config.global.config.warnHandler = () => null;
