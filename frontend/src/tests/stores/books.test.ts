/**
 * Books Store Tests
 *
 * Tests for books state management using Pinia.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBooksStore } from '@/stores/books';
import { booksApi } from '@/api/books';

// Mock the books API
vi.mock('@/api/books', () => ({
  booksApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Books Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const mockBook = {
    entryId: 1,
    entityId: 1,
    type: 'book',
    data: {
      title: 'Test Book',
      isbn: '9780743273565',
      authors: ['Test Author'],
    },
    enteredAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
  };

  describe('initial state', () => {
    test('starts with empty books array', () => {
      const store = useBooksStore();

      expect(store.books).toEqual([]);
      expect(store.currentBook).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.bookCount).toBe(0);
    });
  });

  describe('fetchBooks', () => {
    test('successfully fetches books', async () => {
      const mockResponse = {
        data: {
          books: [mockBook],
        },
        error: null,
      };

      (booksApi.list as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      await store.fetchBooks();

      expect(store.books).toEqual([mockBook]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.bookCount).toBe(1);
    });

    test('handles fetch error', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Network error', code: 'NETWORK_ERROR' },
      };

      (booksApi.list as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      await store.fetchBooks();

      expect(store.books).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Network error');
    });

    test('sets loading state during fetch', async () => {
      let loadingDuringCall = false;

      (booksApi.list as any).mockImplementation(async () => {
        const store = useBooksStore();
        loadingDuringCall = store.loading;

        return {
          data: { books: [] },
          error: null,
        };
      });

      const store = useBooksStore();
      await store.fetchBooks();

      expect(loadingDuringCall).toBe(true);
      expect(store.loading).toBe(false);
    });
  });

  describe('fetchBook', () => {
    test('successfully fetches single book', async () => {
      const mockResponse = {
        data: {
          book: mockBook,
        },
        error: null,
      };

      (booksApi.getById as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      await store.fetchBook(1);

      expect(store.currentBook).toEqual(mockBook);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    test('handles fetch error', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Book not found', code: 'NOT_FOUND' },
      };

      (booksApi.getById as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      await store.fetchBook(999);

      expect(store.currentBook).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Book not found');
    });
  });

  describe('createBook', () => {
    test('successfully creates book', async () => {
      const newBook = {
        ...mockBook,
        entityId: 2,
        data: {
          title: 'New Book',
          isbn: '9780451524935',
        },
      };

      const mockResponse = {
        data: {
          book: newBook,
        },
        error: null,
      };

      (booksApi.create as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      const result = await store.createBook({
        title: 'New Book',
        isbn13: '9780451524935',
      });

      expect(result).toBe(true);
      expect(store.books).toContainEqual(newBook);
      expect(store.bookCount).toBe(1);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    test('handles create error', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Validation error', code: 'VALIDATION_ERROR' },
      };

      (booksApi.create as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      const result = await store.createBook({
        title: 'Invalid Book',
      });

      expect(result).toBe(false);
      expect(store.books).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Validation error');
    });
  });

  describe('updateBook', () => {
    test('successfully updates book in list', async () => {
      const updatedBook = {
        ...mockBook,
        data: {
          ...mockBook.data,
          title: 'Updated Title',
        },
      };

      const mockResponse = {
        data: {
          book: updatedBook,
        },
        error: null,
      };

      (booksApi.update as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      store.books = [mockBook];

      const result = await store.updateBook(1, {
        title: 'Updated Title',
      });

      expect(result).toBe(true);
      expect(store.books[0]).toEqual(updatedBook);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    test('updates currentBook if it matches', async () => {
      const updatedBook = {
        ...mockBook,
        data: {
          ...mockBook.data,
          title: 'Updated Title',
        },
      };

      const mockResponse = {
        data: {
          book: updatedBook,
        },
        error: null,
      };

      (booksApi.update as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      store.books = [mockBook];
      store.currentBook = mockBook;

      await store.updateBook(1, {
        title: 'Updated Title',
      });

      expect(store.currentBook).toEqual(updatedBook);
    });

    test('handles update error', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Update failed', code: 'UPDATE_FAILED' },
      };

      (booksApi.update as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      store.books = [mockBook];

      const result = await store.updateBook(1, {
        title: 'Updated Title',
      });

      expect(result).toBe(false);
      expect(store.books[0]).toEqual(mockBook); // Unchanged
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Update failed');
    });
  });

  describe('deleteBook', () => {
    test('successfully deletes book from list', async () => {
      const mockResponse = {
        data: { success: true },
        error: null,
      };

      (booksApi.delete as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      store.books = [mockBook];

      const result = await store.deleteBook(1);

      expect(result).toBe(true);
      expect(store.books).toEqual([]);
      expect(store.bookCount).toBe(0);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    test('clears currentBook if it matches', async () => {
      const mockResponse = {
        data: { success: true },
        error: null,
      };

      (booksApi.delete as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      store.books = [mockBook];
      store.currentBook = mockBook;

      await store.deleteBook(1);

      expect(store.currentBook).toBeNull();
    });

    test('handles delete error', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'Delete failed', code: 'DELETE_FAILED' },
      };

      (booksApi.delete as any).mockResolvedValue(mockResponse);

      const store = useBooksStore();
      store.books = [mockBook];

      const result = await store.deleteBook(1);

      expect(result).toBe(false);
      expect(store.books).toEqual([mockBook]); // Unchanged
      expect(store.loading).toBe(false);
      expect(store.error).toBe('Delete failed');
    });
  });

  describe('bookCount computed', () => {
    test('returns correct count', () => {
      const store = useBooksStore();

      expect(store.bookCount).toBe(0);

      store.books = [mockBook];
      expect(store.bookCount).toBe(1);

      store.books = [mockBook, { ...mockBook, entityId: 2 }];
      expect(store.bookCount).toBe(2);
    });
  });
});
