/**
 * LocalStorage mock setup
 *
 * Manual localStorage mock for Bun + Vitest + happy-dom.
 * Based on recommendations from vitest documentation.
 */

import { vi } from 'vitest';

// Create a simple in-memory storage implementation
class LocalStorageMock {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

// Install the mock globally
const localStorageMock = new LocalStorageMock();

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', new LocalStorageMock());
