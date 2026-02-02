/**
 * Entities table client
 *
 * Provides a type-safe interface for interacting with the append-only entities table.
 * Implements the event-sourcing pattern where each entity can have multiple entries,
 * and the latest entry represents the current state.
 */

import type { Sql } from "./connection";
import { parseDatabaseError } from "@/errors";

// =============================================================================
// Core Types
// =============================================================================

/**
 * Raw entry as stored in the database
 */
export interface Entry<T = unknown> {
  entryId: number;
  enteredAt: Date;
  type: string;
  data: T;
  entityId: number;
  deletedAt: Date | null;
}

/**
 * Input for creating a new entity (entity_id will be auto-generated)
 */
export interface CreateEntityInput<T = unknown> {
  type: string;
  data: T;
}

/**
 * Input for updating an existing entity (adds a new entry with existing entity_id)
 */
export interface UpdateEntityInput<T = unknown> {
  entityId: number;
  type: string;
  data: T;
}

/**
 * Input for soft-deleting an entity
 */
export interface DeleteEntityInput<T = unknown> {
  entityId: number;
  type: string;
  data: T;
}

/**
 * Options for querying entities
 */
export interface QueryOptions {
  /** Include soft-deleted entities (default: false) */
  includeDeleted?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// =============================================================================
// Entities Client
// =============================================================================

export class EntitiesClient {
  constructor(private sql: Sql) {}

  // ---------------------------------------------------------------------------
  // Create Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new entity with auto-generated entity_id
   * Returns the created entry including the new entity_id
   */
  async create<T>(input: CreateEntityInput<T>): Promise<Entry<T>> {
    try {
      // Pass object directly - Bun SQL handles JSONB conversion
      const rows = await this.sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (nextval('entity_id_seq'), ${input.type}, ${input.data})
        RETURNING *
      `;
      return this.mapRow<T>(rows[0]);
    } catch (error) {
      throw parseDatabaseError(error, `create entity (type: ${input.type})`);
    }
  }

  /**
   * Create multiple new entities in a single transaction
   */
  async createMany<T>(inputs: CreateEntityInput<T>[]): Promise<Entry<T>[]> {
    if (inputs.length === 0) return [];

    try {
      return await this.sql.begin(async (tx) => {
        const entries: Entry<T>[] = [];
        for (const input of inputs) {
          const rows = await tx`
            INSERT INTO entities (entity_id, type, data)
          VALUES (nextval('entity_id_seq'), ${input.type}, ${input.data})
          RETURNING *
        `;
          entries.push(this.mapRow<T>(rows[0]));
        }
        return entries;
      });
    } catch (error) {
      throw parseDatabaseError(error, `create multiple entities (count: ${inputs.length})`);
    }
  }

  // ---------------------------------------------------------------------------
  // Update Operations
  // ---------------------------------------------------------------------------

  /**
   * Update an existing entity by adding a new entry with the same entity_id
   * The latest entry represents the current state of the entity
   */
  async update<T>(input: UpdateEntityInput<T>): Promise<Entry<T>> {
    try {
      const rows = await this.sql`
        INSERT INTO entities (entity_id, type, data)
        VALUES (${input.entityId}, ${input.type}, ${input.data})
        RETURNING *
      `;
      return this.mapRow<T>(rows[0]);
    } catch (error) {
      throw parseDatabaseError(error, `update entity (id: ${input.entityId}, type: ${input.type})`);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Operations
  // ---------------------------------------------------------------------------

  /**
   * Soft-delete an entity by adding a new entry with deleted_at set
   * The entity data is preserved for audit purposes
   */
  async delete<T>(input: DeleteEntityInput<T>): Promise<Entry<T>> {
    try {
      const rows = await this.sql`
        INSERT INTO entities (entity_id, type, data, deleted_at)
        VALUES (${input.entityId}, ${input.type}, ${input.data}, NOW())
        RETURNING *
      `;
      return this.mapRow<T>(rows[0]);
    } catch (error) {
      throw parseDatabaseError(error, `delete entity (id: ${input.entityId}, type: ${input.type})`);
    }
  }

  /**
   * Restore a soft-deleted entity by adding a new entry without deleted_at
   */
  async restore<T>(input: UpdateEntityInput<T>): Promise<Entry<T>> {
    return this.update(input);
  }

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  /**
   * Get the latest entry for an entity by entity_id
   * Returns null if entity doesn't exist or is deleted (unless includeDeleted is true)
   */
  async getById<T>(
    entityId: number,
    options: QueryOptions = {}
  ): Promise<Entry<T> | null> {
    try {
      const { includeDeleted = false } = options;

      // Always get the latest entry first
      const rows = await this.sql`
        SELECT * FROM entities
        WHERE entity_id = ${entityId}
        ORDER BY entered_at DESC
        LIMIT 1
      `;

      if (!rows[0]) return null;

      const entry = this.mapRow<T>(rows[0]);

      // If not including deleted, return null if the latest entry is deleted
      if (!includeDeleted && entry.deletedAt !== null) {
        return null;
      }

      return entry;
    } catch (error) {
      throw parseDatabaseError(error, `get entity by id (id: ${entityId})`);
    }
  }

  /**
   * Get all entries (history) for an entity
   * Ordered by entered_at ascending (oldest first)
   */
  async getHistory<T>(
    entityId: number,
    options: QueryOptions = {}
  ): Promise<Entry<T>[]> {
    // Note: includeDeleted defaults to true for history (to see all versions)
    const { includeDeleted = true } = options;
    const fragments = this.buildQueryFragments({ ...options, includeDeleted });

    const rows = await this.sql`
      SELECT * FROM entities
      WHERE entity_id = ${entityId}
      ${fragments.whereClause}
      ORDER BY entered_at ASC
      ${fragments.limitClause}
      ${fragments.offsetClause}
    `;

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Get the latest entries for all entities of a given type
   */
  async getByType<T>(
    type: string,
    options: QueryOptions = {}
  ): Promise<Entry<T>[]> {
    const { includeDeleted = false } = options;
    const fragments = this.buildQueryFragments(options);

    const rows = await this.sql`
      SELECT * FROM (
        SELECT DISTINCT ON (entity_id) *
        FROM entities
        WHERE type = ${type}
        ORDER BY entity_id, entered_at DESC
      ) latest
      ${includeDeleted ? this.sql`` : this.sql`WHERE deleted_at IS NULL`}
      ORDER BY entered_at DESC
      ${fragments.limitClause}
      ${fragments.offsetClause}
    `;

    return rows.map((row: any) => this.mapRow<T>(row));
  }

  /**
   * Check if an entity exists and is not deleted
   */
  async exists(entityId: number): Promise<boolean> {
    // Get the latest entry for this entity and check if it's not deleted
    const entry = await this.getById(entityId);
    return entry !== null;
  }

  /**
   * Count entities of a given type
   */
  async countByType(
    type: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<number> {
    const { includeDeleted = false } = options;

    let rows;
    if (includeDeleted) {
      rows = await this.sql`
        SELECT COUNT(*) as count FROM (
          SELECT DISTINCT ON (entity_id) entity_id
          FROM entities
          WHERE type = ${type}
          ORDER BY entity_id, entered_at DESC
        ) latest
      `;
    } else {
      rows = await this.sql`
        SELECT COUNT(*) as count FROM (
          SELECT DISTINCT ON (entity_id) entity_id, deleted_at
          FROM entities
          WHERE type = ${type}
          ORDER BY entity_id, entered_at DESC
        ) latest
        WHERE deleted_at IS NULL
      `;
    }

    return Number(rows[0]?.count ?? 0);
  }

  // ---------------------------------------------------------------------------
  // Search Operations
  // ---------------------------------------------------------------------------

  /**
   * Search entities by JSONB data using containment operator (@>)
   * Example: findByData({ status: 'active' }) finds all entities where data contains { status: 'active' }
   *
   * Note: This searches the LATEST version of each entity's data.
   */
  async findByData<T>(
    type: string,
    dataQuery: Record<string, unknown>,
    options: QueryOptions = {}
  ): Promise<Entry<T>[]> {
    const { includeDeleted = false } = options;
    const fragments = this.buildQueryFragments(options);
    // Pass object directly - Bun SQL handles JSONB conversion automatically

    const rows = await this.sql`
      SELECT * FROM (
        SELECT DISTINCT ON (entity_id) *
        FROM entities
        WHERE type = ${type}
        ORDER BY entity_id, entered_at DESC
      ) latest
      WHERE data @> ${dataQuery}
        ${includeDeleted ? this.sql`` : this.sql`AND deleted_at IS NULL`}
      ORDER BY entered_at DESC
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
   * Map a database row to an Entry object
   * Handles column name transformation (snake_case to camelCase)
   * and type conversions (JSONB parsing, bigint to number)
   */
  private mapRow<T>(row: any): Entry<T> {
    // Parse JSONB data if it comes back as a string
    let data = row.data;
    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    return {
      entryId: Number(row.entry_id),
      enteredAt: row.entered_at,
      type: row.type,
      data,
      entityId: Number(row.entity_id),
      deletedAt: row.deleted_at,
    };
  }

  /**
   * Build dynamic SQL fragments for filtering and pagination.
   * Uses Bun SQL template literals for safe composition.
   */
  private buildQueryFragments(options: QueryOptions) {
    const { includeDeleted = false, limit, offset } = options;

    return {
      whereClause: includeDeleted
        ? this.sql``
        : this.sql`AND deleted_at IS NULL`,
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
 * Create an entities client with a database connection
 */
export function createEntitiesClient(sql: Sql): EntitiesClient {
  return new EntitiesClient(sql);
}
