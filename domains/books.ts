/**
 * # Book Collection
 *
 * > Manages physical books and tracks their lifecycle events, primarily acquisition history.
 *
 * This domain captures the provenance and story of each physical book in my collection.
 * It answers questions like: What books do I own? When and where did I acquire each book?
 * Who gave me this book? How much did I pay for it?
 *
 * The system helps prevent buying duplicates and preserves the acquisition stories that
 * give context to the collection.
 *
 * ## Physical Books
 *
 * > A specific physical edition that exists in the collection.
 *
 * Each book is uniquely identified by an entity_id in the system. External identifiers
 * like ISBN and LCCN are optional attributes. Two different editions of the same work
 * are two different Physical Books.
 *
 * Books may have:
 * - Bibliographic information (title, subtitle, author) - all optional but usually present
 * - Edition identifiers (ISBN-10, ISBN-13, LCCN) - optional
 * - Series reference (series_id) - optional
 * - Personal notes - optional
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
 * ## Money
 *
 * > Represents a monetary amount with currency.
 */

export type Money = {
  amount: number
  currency: string // e.g., "USD"
}

/**
 * ## Acquisition Events
 *
 * > Records when and how a book entered the collection.
 *
 * Every book that I tracked the acquisition for has exactly one Acquired event.
 * Historical books may not have an Acquired event (information not recorded).
 *
 * Acquisition is a discriminated union (algebraic sum type) with five variants
 * based on how the book was obtained: purchased, ordered, given, won, or inherited.
 * Each variant has its own required and optional fields.
 *
 * ### Purchased
 *
 * > Book bought from a physical store.
 *
 * Always has: location_id (reference to Locations domain), cost, date
 * Optional: notes about circumstances
 */

export type PurchasedAcquisition = {
  type: 'purchased'
  location_id: string
  cost: Money
  date: Date
  notes?: string
}

/**
 * ### Ordered
 *
 * > Book bought online or via mail order.
 *
 * Always has: cost, date
 * Optional: notes about circumstances
 */

export type OrderedAcquisition = {
  type: 'ordered'
  cost: Money
  date: Date
  notes?: string
}

/**
 * ### Given
 *
 * > Book received as a gift.
 *
 * Always has: person_id (reference to Contacts domain), date
 * Optional: notes about circumstances and context
 */

export type GivenAcquisition = {
  type: 'given'
  person_id: string
  date: Date
  notes?: string
}

/**
 * ### Won
 *
 * > Book obtained through winning (contests, bingo, raffles, etc.).
 *
 * Always has: date
 * Optional: notes about how/where won
 */

export type WonAcquisition = {
  type: 'won'
  date: Date
  notes?: string
}

/**
 * ### Inherited
 *
 * > Book received from family, estate, or previous ownership.
 *
 * Optional: date (may not know when inherited)
 * Optional: notes about provenance
 */

export type InheritedAcquisition = {
  type: 'inherited'
  date?: Date
  notes?: string
}

/**
 * ### Acquisition Event Union
 *
 * > All possible acquisition variants.
 */

export type AcquisitionEvent =
  | PurchasedAcquisition
  | OrderedAcquisition
  | GivenAcquisition
  | WonAcquisition
  | InheritedAcquisition

/**
 * ## Future Events (Not Yet Implemented)
 *
 * > Planned events for tracking lending and disposal.
 *
 * ### Lent
 *
 * > Book checked out to someone.
 */

export type LentEvent = {
  type: 'lent'
  person_id: string
  date: Date
  notes?: string
}

/**
 * ### Returned
 *
 * > Book came back from being lent.
 */

export type ReturnedEvent = {
  type: 'returned'
  date: Date
  notes?: string
}

/**
 * ### Disposed
 *
 * > Book permanently left collection (terminal state).
 */

export type DisposedEvent = {
  type: 'disposed'
  reason: 'destroyed' | 'given_away' | 'sold' | 'lost' | 'other'
  date: Date
  notes?: string
}

/**
 * ### All Book Events
 *
 * > Union of current and future event types.
 */

export type BookEvent =
  | AcquisitionEvent
  | LentEvent
  | ReturnedEvent
  | DisposedEvent

/**
 * ## Persistence Types
 *
 * > Types for storing books in the database.
 *
 * Books are stored using the event-sourced entity pattern with JSONB data fields.
 *
 * ### Book Entity Snapshot
 *
 * > What gets stored in the JSONB `data` field for a book entity.
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
 * ### Book Entity Row
 *
 * > The complete database row for a book entity.
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
 * ### Acquisition Event Snapshot
 *
 * > What gets stored in the JSONB `data` field for an acquisition event.
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
 * ### Acquisition Event Row
 *
 * > The complete database row for an acquisition event.
 */

export type AcquisitionEventRow = {
  entity_id: number
  entity_type: 'acquisition'
  data: AcquisitionEventSnapshot
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

/**
 * ## Query Result Types
 *
 * > Common projections for displaying book data.
 *
 * ### Book With Acquisition
 *
 * > A book entity joined with its acquisition event.
 *
 * This is a common query result when displaying book details.
 */

export type BookWithAcquisition = {
  book: PhysicalBook
  acquisition?: AcquisitionEvent
}

/**
 * ### Book List Item
 *
 * > Minimal book information for list views.
 */

export type BookListItem = {
  entity_id: string
  title?: string
  subtitle?: string
  author?: string
  acquisition_date?: Date
}

/**
 * ## Type Guards
 *
 * > Runtime type checking for acquisition variants.
 */

export function isPurchased(acq: AcquisitionEvent): acq is PurchasedAcquisition {
  return acq.type === 'purchased'
}

export function isOrdered(acq: AcquisitionEvent): acq is OrderedAcquisition {
  return acq.type === 'ordered'
}

export function isGiven(acq: AcquisitionEvent): acq is GivenAcquisition {
  return acq.type === 'given'
}

export function isWon(acq: AcquisitionEvent): acq is WonAcquisition {
  return acq.type === 'won'
}

export function isInherited(acq: AcquisitionEvent): acq is InheritedAcquisition {
  return acq.type === 'inherited'
}

/**
 * ## Display Utilities
 *
 * > Helper functions for presenting book information.
 *
 * ### Get Book Display Name
 *
 * > Creates a human-readable name for a book, using subtitle and author to disambiguate.
 *
 * When displaying books with identical titles, distinguish them using:
 * 1. Subtitle (if present)
 * 2. Author (if present)
 * 3. ISBN (as last resort for technical contexts)
 *
 * Examples:
 * - "Water: A Journey Through the Element"
 * - "Water: Exploring the Blue Planet"
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

/**
 * ## References to Other Domains
 *
 * > Books reference other bounded contexts through IDs only.
 *
 * - **Location** (from Locations domain): Referenced by location_id in Purchased acquisitions
 * - **Person** (from Contacts/People domain): Referenced by person_id in Given acquisitions
 * - **Series** (from Series domain): Referenced by series_id on books that belong to a series
 *
 * ## Invariants
 *
 * > Rules that must be maintained.
 *
 * **Hard Invariants** (enforced by system):
 * 1. Every book has a unique entity_id
 * 2. (Future) A book cannot be Lent if currently lent out
 * 3. (Future) A book cannot have events after Disposed
 *
 * **Soft Expectations** (usually true, not enforced):
 * - Books usually have titles
 * - Books usually have acquisition information
 * - Books usually have some form of identification (ISBN or LCCN)
 *
 * The system acknowledges that real-world data is messy - some books were acquired
 * before tracking began, some publications lack standard identifiers, and some
 * information may be lost or never recorded.
 *
 * ## Use Cases
 *
 * > Primary ways this domain is used.
 *
 * **Primary Use Cases:**
 * 1. Check if I already own a book (avoid duplicates)
 * 2. View acquisition history and stories
 * 3. Track spending on books
 * 4. Browse collection by various attributes
 *
 * **Key Queries:**
 * - Find book by title
 * - List all books
 * - List books by series
 * - List books acquired from specific location
 * - List books given by specific person
 * - List books without acquisition information
 * - Calculate total spending on books
 */
