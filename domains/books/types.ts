/**
 * Book Collection Domain Types
 * 
 * This file contains TypeScript types for the Book Collection bounded context.
 * It includes both domain types (how we think about books) and persistence types
 * (how books are stored in the database).
 */

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Physical Book - The core entity representing a specific physical edition
 * that exists in the collection.
 */
export type PhysicalBook = {
  entity_id: string
  title?: string
  subtitle?: string
  author?: string
  series_id?: string
  isbn10?: string
  isbn13?: string
  lccn?: string
  note?: string
}

/**
 * Money - Represents a monetary amount with currency
 */
export type Money = {
  amount: number
  currency: string // e.g., "USD"
}

/**
 * Acquisition Event - Domain event representing when and how a book
 * entered the collection. This is a discriminated union (algebraic sum type)
 * where each variant has its own required and optional fields.
 */
export type AcquisitionEvent =
  | PurchasedAcquisition
  | OrderedAcquisition
  | GivenAcquisition
  | WonAcquisition
  | InheritedAcquisition

/**
 * Purchased - Book bought from a physical store
 */
export type PurchasedAcquisition = {
  type: 'purchased'
  location_id: string
  cost: Money
  date: Date
  notes?: string
}

/**
 * Ordered - Book bought online or via mail order
 */
export type OrderedAcquisition = {
  type: 'ordered'
  cost: Money
  date: Date
  notes?: string
}

/**
 * Given - Book received as a gift
 */
export type GivenAcquisition = {
  type: 'given'
  person_id: string
  date: Date
  notes?: string
}

/**
 * Won - Book obtained through winning (contest, raffle, etc.)
 */
export type WonAcquisition = {
  type: 'won'
  date: Date
  notes?: string
}

/**
 * Inherited - Book received from family, estate, or previous ownership
 */
export type InheritedAcquisition = {
  type: 'inherited'
  date?: Date
  notes?: string
}

// ============================================================================
// Future Event Types (Not Yet Implemented)
// ============================================================================

/**
 * Lent - Book checked out to someone (future)
 */
export type LentEvent = {
  type: 'lent'
  person_id: string
  date: Date
  notes?: string
}

/**
 * Returned - Book came back from being lent (future)
 */
export type ReturnedEvent = {
  type: 'returned'
  date: Date
  notes?: string
}

/**
 * Disposed - Book permanently left collection (future)
 */
export type DisposedEvent = {
  type: 'disposed'
  reason: 'destroyed' | 'given_away' | 'sold' | 'lost' | 'other'
  date: Date
  notes?: string
}

/**
 * All possible book events (current and future)
 */
export type BookEvent =
  | AcquisitionEvent
  | LentEvent
  | ReturnedEvent
  | DisposedEvent

// ============================================================================
// Persistence Types
// ============================================================================

/**
 * BookEntitySnapshot - What gets stored in the JSONB `data` field
 * for a book entity in the database.
 */
export type BookEntitySnapshot = {
  title?: string
  subtitle?: string
  author?: string
  series_id?: string
  isbn10?: string
  isbn13?: string
  lccn?: string
  note?: string
}

/**
 * BookEntityRow - The complete database row for a book entity
 */
export type BookEntityRow = {
  entity_id: number
  entity_type: 'book'
  data: BookEntitySnapshot
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

/**
 * AcquisitionEventSnapshot - What gets stored in the JSONB `data` field
 * for an acquisition event in the database.
 */
export type AcquisitionEventSnapshot = {
  type: 'purchased' | 'ordered' | 'given' | 'won' | 'inherited'
  location_id?: string
  person_id?: string
  cost?: {
    amount: number
    currency: string
  }
  date?: string // ISO date string
  notes?: string
}

/**
 * AcquisitionEventRow - The complete database row for an acquisition event
 */
export type AcquisitionEventRow = {
  entity_id: number
  entity_type: 'acquisition'
  data: AcquisitionEventSnapshot
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * BookWithAcquisition - A book entity joined with its acquisition event
 * This is a common query result when displaying book details.
 */
export type BookWithAcquisition = {
  book: PhysicalBook
  acquisition?: AcquisitionEvent
}

/**
 * BookListItem - Minimal book information for list views
 */
export type BookListItem = {
  entity_id: string
  title?: string
  subtitle?: string
  author?: string
  acquisition_date?: Date
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an acquisition is a purchase
 */
export function isPurchased(acq: AcquisitionEvent): acq is PurchasedAcquisition {
  return acq.type === 'purchased'
}

/**
 * Type guard to check if an acquisition is ordered
 */
export function isOrdered(acq: AcquisitionEvent): acq is OrderedAcquisition {
  return acq.type === 'ordered'
}

/**
 * Type guard to check if an acquisition is a gift
 */
export function isGiven(acq: AcquisitionEvent): acq is GivenAcquisition {
  return acq.type === 'given'
}

/**
 * Type guard to check if an acquisition was won
 */
export function isWon(acq: AcquisitionEvent): acq is WonAcquisition {
  return acq.type === 'won'
}

/**
 * Type guard to check if an acquisition was inherited
 */
export function isInherited(acq: AcquisitionEvent): acq is InheritedAcquisition {
  return acq.type === 'inherited'
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Helper to get display name for a book, using subtitle and author
 * to disambiguate books with the same title
 */
export function getBookDisplayName(book: PhysicalBook): string {
  if (!book.title) {
    return `Book #${book.entity_id}`
  }
  
  const parts = [book.title]
  
  if (book.subtitle) {
    parts.push(book.subtitle)
  }
  
  if (book.author) {
    parts.push(`by ${book.author}`)
  }
  
  return parts.join(': ')
}
