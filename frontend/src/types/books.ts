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
