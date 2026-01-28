import { api } from './client'
import type { BookEntry, CreateBookRequest, MetadataLookupResponse } from '@/types/books'

export const booksApi = {
  list: () =>
    api.get<{ books: BookEntry[] }>('/books'),

  getById: (id: number) =>
    api.get<{ book: BookEntry }>(`/books/${id}`),

  create: (data: CreateBookRequest) =>
    api.post<{ book: BookEntry }>('/books', data),

  update: (id: number, data: CreateBookRequest) =>
    api.put<{ book: BookEntry }>(`/books/${id}`, data),

  delete: (id: number) =>
    api.delete<{ success: boolean }>(`/books/${id}`),

  lookupMetadata: (identifier: string, identifierType: 'isbn' | 'lccn') =>
    api.post<MetadataLookupResponse>('/books/metadata/lookup', { identifier, identifierType })
}
