/**
 * Events table client
 *
 * Provides a type-safe interface for interacting with the append-only events table.
 * Implements the event-sourcing pattern where each event can have multiple entries,
 * and the latest entry represents the current enriched state.
 *
 * Events are facts about what happened (verbs), distinct from entities (nouns).
 * The original event data is preserved, but can be enriched with annotations,
 * corrections, or links by appending new entries with the same event_id.
 */

import type { Sql } from "./connection";

// =============================================================================
// Core Types
// =============================================================================

/**
 * Raw entry as stored in the database
 */
export interface EventEntry<T = unknown> {
  entryId: number;
  enteredAt: Date;
  eventType: string;
  occurredAt: Date;
  data: T;
  eventId: number;
  voidedAt: Date | null;
}

/**
 * Input for recording a new event (event_id will be auto-generated)
 */
export interface RecordEventInput<T = unknown> {
  eventType: string;
  occurredAt: Date;
  data: T;
}

/**
 * Input for enriching an existing event (adds a new entry with existing event_id)
 */
export interface EnrichEventInput<T = unknown> {
  eventId: number;
  eventType: string;
  occurredAt: Date;
  data: T;
}

/**
 * Input for voiding an event
 */
export interface VoidEventInput<T = unknown> {
  eventId: number;
  eventType: string;
  occurredAt: Date;
  data: T;
}

/**
 * Options for querying events
 */
export interface EventQueryOptions {
  /** Include voided events (default: false) */
  includeVoided?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// =============================================================================
// Events Client
// =============================================================================

export class EventsClient {
  constructor(private sql: Sql) {}

  // ---------------------------------------------------------------------------
  // Create Operations
  // ---------------------------------------------------------------------------

  /**
   * Record a new event with auto-generated event_id
   * Returns the created entry including the new event_id
   */
  async record<T>(input: RecordEventInput<T>): Promise<EventEntry<T>> {
    const rows = await this.sql`
      INSERT INTO events (event_id, event_type, occurred_at, data)
      VALUES (nextval('event_id_seq'), ${input.eventType}, ${input.occurredAt}, ${input.data})
      RETURNING *
    `;
    return this.mapRow<T>(rows[0]);
  }

  /**
   * Record multiple new events in a single transaction
   */
  async recordMany<T>(inputs: RecordEventInput<T>[]): Promise<EventEntry<T>[]> {
    if (inputs.length === 0) return [];

    return await this.sql.begin(async (tx) => {
      const entries: EventEntry<T>[] = [];
      for (const input of inputs) {
        const rows = await tx`
          INSERT INTO events (event_id, event_type, occurred_at, data)
          VALUES (nextval('event_id_seq'), ${input.eventType}, ${input.occurredAt}, ${input.data})
          RETURNING *
        `;
        entries.push(this.mapRow<T>(rows[0]));
      }
      return entries;
    });
  }

  // ---------------------------------------------------------------------------
  // Enrich Operations
  // ---------------------------------------------------------------------------

  /**
   * Enrich an existing event by adding a new entry with the same event_id
   * The latest entry represents the current enriched state of the event
   * Use this to add annotations, corrections, tags, or links
   */
  async enrich<T>(input: EnrichEventInput<T>): Promise<EventEntry<T>> {
    const rows = await this.sql`
      INSERT INTO events (event_id, event_type, occurred_at, data)
      VALUES (${input.eventId}, ${input.eventType}, ${input.occurredAt}, ${input.data})
      RETURNING *
    `;
    return this.mapRow<T>(rows[0]);
  }

  // ---------------------------------------------------------------------------
  // Void Operations
  // ---------------------------------------------------------------------------

  /**
   * Void an event by adding a new entry with voided_at set
   * The event data is preserved for audit purposes
   * Voided events are excluded from default queries
   */
  async void<T>(input: VoidEventInput<T>): Promise<EventEntry<T>> {
    const rows = await this.sql`
      INSERT INTO events (event_id, event_type, occurred_at, data, voided_at)
      VALUES (${input.eventId}, ${input.eventType}, ${input.occurredAt}, ${input.data}, NOW())
      RETURNING *
    `;
    return this.mapRow<T>(rows[0]);
  }

  /**
   * Restore a voided event by adding a new entry without voided_at
   */
  async restore<T>(input: EnrichEventInput<T>): Promise<EventEntry<T>> {
    return this.enrich(input);
  }

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  /**
   * Get the latest entry for an event by event_id
   * Returns null if event doesn't exist or is voided (unless includeVoided is true)
   */
  async getById<T>(
    eventId: number,
    options: EventQueryOptions = {}
  ): Promise<EventEntry<T> | null> {
    const { includeVoided = false } = options;

    // Always get the latest entry first
    const rows = await this.sql`
      SELECT * FROM events
      WHERE event_id = ${eventId}
      ORDER BY entered_at DESC
      LIMIT 1
    `;

    if (!rows[0]) return null;

    const entry = this.mapRow<T>(rows[0]);

    // If not including voided, return null if the latest entry is voided
    if (!includeVoided && entry.voidedAt !== null) {
      return null;
    }

    return entry;
  }

  /**
   * Get all entries (history) for an event
   * Ordered by entered_at ascending (oldest first)
   */
  async getHistory<T>(
    eventId: number,
    options: EventQueryOptions = {}
  ): Promise<EventEntry<T>[]> {
    // Note: includeVoided defaults to true for history (to see all versions)
    const { includeVoided = true } = options;
    const fragments = this.buildQueryFragments({ ...options, includeVoided });

    const rows = await this.sql`
      SELECT * FROM events
      WHERE event_id = ${eventId}
      ${fragments.whereClause}
      ORDER BY entered_at ASC
      ${fragments.limitClause}
      ${fragments.offsetClause}
    `;

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Get the latest entries for all events of a given type
   * Ordered by occurred_at descending (most recent events first)
   */
  async getByType<T>(
    eventType: string,
    options: EventQueryOptions = {}
  ): Promise<EventEntry<T>[]> {
    const { includeVoided = false } = options;
    const fragments = this.buildQueryFragments(options);

    const rows = await this.sql`
      SELECT * FROM (
        SELECT DISTINCT ON (event_id) *
        FROM events
        WHERE event_type = ${eventType}
        ORDER BY event_id, entered_at DESC
      ) latest
      ${includeVoided ? this.sql`` : this.sql`WHERE voided_at IS NULL`}
      ORDER BY occurred_at DESC
      ${fragments.limitClause}
      ${fragments.offsetClause}
    `;

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Get events within a time range (by occurred_at)
   * Returns the latest entry for each event
   */
  async getByTimeRange<T>(
    start: Date,
    end: Date,
    options: EventQueryOptions = {}
  ): Promise<EventEntry<T>[]> {
    const { includeVoided = false } = options;
    const fragments = this.buildQueryFragments(options);

    const rows = await this.sql`
      SELECT * FROM (
        SELECT DISTINCT ON (event_id) *
        FROM events
        WHERE occurred_at BETWEEN ${start} AND ${end}
        ORDER BY event_id, entered_at DESC
      ) latest
      ${includeVoided ? this.sql`` : this.sql`WHERE voided_at IS NULL`}
      ORDER BY occurred_at DESC
      ${fragments.limitClause}
      ${fragments.offsetClause}
    `;

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Check if an event exists and is not voided
   */
  async exists(eventId: number): Promise<boolean> {
    const entry = await this.getById(eventId);
    return entry !== null;
  }

  /**
   * Count events of a given type
   */
  async countByType(
    eventType: string,
    options: { includeVoided?: boolean } = {}
  ): Promise<number> {
    const { includeVoided = false } = options;

    let rows;
    if (includeVoided) {
      rows = await this.sql`
        SELECT COUNT(*) as count FROM (
          SELECT DISTINCT ON (event_id) event_id
          FROM events
          WHERE event_type = ${eventType}
          ORDER BY event_id, entered_at DESC
        ) latest
      `;
    } else {
      rows = await this.sql`
        SELECT COUNT(*) as count FROM (
          SELECT DISTINCT ON (event_id) event_id, voided_at
          FROM events
          WHERE event_type = ${eventType}
          ORDER BY event_id, entered_at DESC
        ) latest
        WHERE voided_at IS NULL
      `;
    }

    return Number(rows[0]?.count ?? 0);
  }

  // ---------------------------------------------------------------------------
  // Search Operations
  // ---------------------------------------------------------------------------

  /**
   * Search events by JSONB data using containment operator (@>)
   * Example: findByData('book_acquired', { book_id: 123 }) finds events with that book
   *
   * Note: This searches the LATEST version of each event's data.
   */
  async findByData<T>(
    eventType: string,
    dataQuery: Record<string, unknown>,
    options: EventQueryOptions = {}
  ): Promise<EventEntry<T>[]> {
    const { includeVoided = false } = options;
    const fragments = this.buildQueryFragments(options);

    const rows = await this.sql`
      SELECT * FROM (
        SELECT DISTINCT ON (event_id) *
        FROM events
        WHERE event_type = ${eventType}
        ORDER BY event_id, entered_at DESC
      ) latest
      WHERE data @> ${dataQuery}
        ${includeVoided ? this.sql`` : this.sql`AND voided_at IS NULL`}
      ORDER BY occurred_at DESC
      ${fragments.limitClause}
      ${fragments.offsetClause}
    `;

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Find events related to a specific entity
   * Uses JSONB containment query to find events where data contains the specified field
   * Example: findForEntity('book_id', 123) finds all events where data.book_id = 123
   */
  async findForEntity<T>(
    entityIdField: string,
    entityId: string | number,
    options: EventQueryOptions = {}
  ): Promise<EventEntry<T>[]> {
    const { includeVoided = false } = options;
    const fragments = this.buildQueryFragments(options);
    const dataQuery = { [entityIdField]: entityId };

    const rows = await this.sql`
      SELECT * FROM (
        SELECT DISTINCT ON (event_id) *
        FROM events
        ORDER BY event_id, entered_at DESC
      ) latest
      WHERE data @> ${dataQuery}
        ${includeVoided ? this.sql`` : this.sql`AND voided_at IS NULL`}
      ORDER BY occurred_at DESC
      ${fragments.limitClause}
      ${fragments.offsetClause}
    `;

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  // ---------------------------------------------------------------------------
  // Utility Operations
  // ---------------------------------------------------------------------------

  /**
   * Get the raw SQL instance for advanced queries
   * Use with caution - prefer the typed methods above
   */
  get raw(): Sql {
    return this.sql;
  }

  /**
   * Map a database row to an EventEntry object
   * Handles column name transformation (snake_case to camelCase)
   * and type conversions (JSONB parsing, bigint to number)
   */
  private mapRow<T>(row: any): EventEntry<T> {
    // Parse JSONB data if it comes back as a string
    let data = row.data;
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    return {
      entryId: Number(row.entry_id),
      enteredAt: row.entered_at,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      data,
      eventId: Number(row.event_id),
      voidedAt: row.voided_at,
    };
  }

  /**
   * Build dynamic SQL fragments for filtering and pagination.
   * Uses Bun SQL template literals for safe composition.
   */
  private buildQueryFragments(options: EventQueryOptions) {
    const { includeVoided = false, limit, offset } = options;

    return {
      whereClause: includeVoided
        ? this.sql``
        : this.sql`AND voided_at IS NULL`,
      limitClause: limit
        ? this.sql`LIMIT ${limit}`
        : this.sql``,
      offsetClause: offset
        ? this.sql`OFFSET ${offset}`
        : this.sql``,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an events client with a database connection
 */
export function createEventsClient(sql: Sql): EventsClient {
  return new EventsClient(sql);
}
