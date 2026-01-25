/**
 * Events table client
 *
 * Provides a type-safe interface for interacting with the immutable events table.
 * Events are strictly append-only facts about what happened, never updated or deleted.
 */

import type { Sql } from "./connection";

// =============================================================================
// Core Types
// =============================================================================

/**
 * Event as stored in the database
 */
export interface Event<T = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  data: T;
  recordedAt: Date;
}

/**
 * Input for recording a new event
 */
export interface RecordEventInput<T = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  data: T;
}

/**
 * Options for querying events
 */
export interface EventQueryOptions {
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
   * Record a new event
   * Events are immutable and cannot be updated after recording
   * Returns the recorded event including the recorded_at timestamp
   */
  async record<T>(input: RecordEventInput<T>): Promise<Event<T>> {
    const rows = await this.sql`
      INSERT INTO events (event_id, event_type, occurred_at, data)
      VALUES (${input.eventId}, ${input.eventType}, ${input.occurredAt}, ${input.data})
      RETURNING *
    `;
    return this.mapRow<T>(rows[0]);
  }

  /**
   * Record multiple events in a single transaction
   */
  async recordMany<T>(inputs: RecordEventInput<T>[]): Promise<Event<T>[]> {
    if (inputs.length === 0) return [];

    return await this.sql.begin(async (tx) => {
      const events: Event<T>[] = [];
      for (const input of inputs) {
        const rows = await tx`
          INSERT INTO events (event_id, event_type, occurred_at, data)
          VALUES (${input.eventId}, ${input.eventType}, ${input.occurredAt}, ${input.data})
          RETURNING *
        `;
        events.push(this.mapRow<T>(rows[0]));
      }
      return events;
    });
  }

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  /**
   * Find an event by its ID
   * Returns null if event doesn't exist
   */
  async findById<T>(eventId: string): Promise<Event<T> | null> {
    const rows = await this.sql`
      SELECT * FROM events
      WHERE event_id = ${eventId}
    `;
    return rows[0] ? this.mapRow<T>(rows[0]) : null;
  }

  /**
   * Find events by event type
   * Returns events ordered by occurred_at descending (most recent first)
   */
  async findByType<T>(
    eventType: string,
    options: EventQueryOptions = {}
  ): Promise<Event<T>[]> {
    const { limit = 100, offset } = options;

    let rows;
    if (offset) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE event_type = ${eventType}
        ORDER BY occurred_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows = await this.sql`
        SELECT * FROM events
        WHERE event_type = ${eventType}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
      `;
    }

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Find events within a time range
   * Returns events ordered by occurred_at descending (most recent first)
   */
  async findByTimeRange<T>(
    start: Date,
    end: Date,
    options: EventQueryOptions = {}
  ): Promise<Event<T>[]> {
    const { limit, offset } = options;

    let rows;
    if (limit && offset) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE occurred_at BETWEEN ${start} AND ${end}
        ORDER BY occurred_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (limit) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE occurred_at BETWEEN ${start} AND ${end}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
      `;
    } else if (offset) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE occurred_at BETWEEN ${start} AND ${end}
        ORDER BY occurred_at DESC
        OFFSET ${offset}
      `;
    } else {
      rows = await this.sql`
        SELECT * FROM events
        WHERE occurred_at BETWEEN ${start} AND ${end}
        ORDER BY occurred_at DESC
      `;
    }

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Find events related to a specific entity
   * Uses JSONB containment query to find events where data contains the specified field
   * Example: findForEntity('book_id', '123') finds all events where data.book_id = '123'
   */
  async findForEntity<T>(
    entityIdField: string,
    entityId: string | number,
    options: EventQueryOptions = {}
  ): Promise<Event<T>[]> {
    const { limit, offset } = options;
    const query = { [entityIdField]: entityId };

    let rows;
    if (limit && offset) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE data @> ${query}
        ORDER BY occurred_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (limit) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE data @> ${query}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
      `;
    } else if (offset) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE data @> ${query}
        ORDER BY occurred_at DESC
        OFFSET ${offset}
      `;
    } else {
      rows = await this.sql`
        SELECT * FROM events
        WHERE data @> ${query}
        ORDER BY occurred_at DESC
      `;
    }

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Find events matching arbitrary JSONB criteria
   * Uses JSONB containment operator (@>) to match events
   * Example: findByData({ status: 'completed', amount: 100 })
   */
  async findByData<T>(
    dataQuery: Record<string, unknown>,
    options: EventQueryOptions = {}
  ): Promise<Event<T>[]> {
    const { limit, offset } = options;

    let rows;
    if (limit && offset) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE data @> ${dataQuery}
        ORDER BY occurred_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (limit) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE data @> ${dataQuery}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
      `;
    } else if (offset) {
      rows = await this.sql`
        SELECT * FROM events
        WHERE data @> ${dataQuery}
        ORDER BY occurred_at DESC
        OFFSET ${offset}
      `;
    } else {
      rows = await this.sql`
        SELECT * FROM events
        WHERE data @> ${dataQuery}
        ORDER BY occurred_at DESC
      `;
    }

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Count events by type
   */
  async countByType(eventType: string): Promise<number> {
    const rows = await this.sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE event_type = ${eventType}
    `;
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Check if an event exists
   */
  async exists(eventId: string): Promise<boolean> {
    const event = await this.findById(eventId);
    return event !== null;
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
   * Map a database row to an Event object
   * Handles column name transformation (snake_case to camelCase)
   * and type conversions
   */
  private mapRow<T>(row: any): Event<T> {
    // Parse JSONB data if it comes back as a string
    let data = row.data;
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    return {
      eventId: row.event_id,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      data,
      recordedAt: row.recorded_at,
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
