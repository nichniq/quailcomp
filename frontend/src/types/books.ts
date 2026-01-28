export interface BookEntitySnapshot {
  title?: string
  subtitle?: string
  author?: string
  series_id?: string
  isbn10?: string
  isbn13?: string
  lccn?: string
  note?: string
}

export interface BookEntry {
  entryId: number
  enteredAt: string
  type: string
  data: BookEntitySnapshot
  entityId: number
  deletedAt: string | null
}

export interface CreateBookRequest {
  title?: string
  subtitle?: string
  author?: string
  isbn10?: string
  isbn13?: string
  note?: string
}

export interface UpdateBookRequest extends CreateBookRequest {
  entityId: number
}

// Book Metadata Lookup Types

export type BookMetadataProvider =
  | 'google-books'
  | 'open-library'
  | 'library-of-congress'

export interface BookMetadata {
  isbn: string
  isbn10?: string
  isbn13?: string
  lccn?: string
  title: string
  subtitle?: string
  authors: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  pageCount?: number
  language?: string
  subjects?: string[]
  thumbnailUrl?: string
  source: BookMetadataProvider
}

export interface MetadataProviderResult {
  provider: BookMetadataProvider
  data: BookMetadata | null
  error: string | null
  responseTime: number
}

export interface MetadataLookupResponse {
  results: MetadataProviderResult[]
}
