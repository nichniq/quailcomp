/**
 * Entity Type Definitions
 *
 * This file demonstrates different approaches to typing entities in the
 * append-only event-sourced database. Choose the approach that best fits
 * your needs.
 *
 * =============================================================================
 * APPROACH 1: Simple Type Registry (Recommended for Getting Started)
 * =============================================================================
 *
 * Define a mapping of entity type strings to their data types.
 * Simple, type-safe, works well for small-medium number of entity types.
 *
 * Pros:
 * - Simple to understand and maintain
 * - Full TypeScript type inference
 * - No runtime overhead
 *
 * Cons:
 * - All types must be defined upfront
 * - Changes require code changes
 * - No schema versioning built-in
 */

// Define your entity data types
export interface UserData {
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  preferences?: {
    theme: "light" | "dark";
    notifications: boolean;
  };
}

export interface ProductData {
  name: string;
  price: number;
  currency: string;
  sku: string;
  inventory: number;
  tags?: string[];
}

export interface OrderData {
  userId: number;
  items: Array<{
    productId: number;
    quantity: number;
    priceAtPurchase: number;
  }>;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  shippingAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

// Entity type registry - maps type strings to data types
export interface EntityTypeRegistry {
  user: UserData;
  product: ProductData;
  order: OrderData;
}

// Helper type to get all valid entity type strings
export type EntityType = keyof EntityTypeRegistry;

// Helper type to get the data type for a given entity type
export type EntityDataType<T extends EntityType> = EntityTypeRegistry[T];

/**
 * =============================================================================
 * APPROACH 2: Discriminated Unions (Best for Pattern Matching)
 * =============================================================================
 *
 * Use discriminated unions to create a single type that covers all entities.
 * Great for switch statements and exhaustive type checking.
 *
 * Pros:
 * - Excellent for pattern matching
 * - TypeScript ensures all cases are handled
 * - Clear, explicit type definitions
 *
 * Cons:
 * - Can get verbose with many entity types
 * - Adding new types requires updating the union
 */

import type { Entry } from "./entities";

export type TypedEntry =
  | (Entry<UserData> & { type: "user" })
  | (Entry<ProductData> & { type: "product" })
  | (Entry<OrderData> & { type: "order" });

// Usage example:
// function processEntry(entry: TypedEntry) {
//   switch (entry.type) {
//     case 'user':
//       console.log(entry.data.email); // TypeScript knows data is UserData
//       break;
//     case 'product':
//       console.log(entry.data.price); // TypeScript knows data is ProductData
//       break;
//     case 'order':
//       console.log(entry.data.status); // TypeScript knows data is OrderData
//       break;
//   }
// }

/**
 * =============================================================================
 * APPROACH 3: Versioned Types (Best for Schema Evolution)
 * =============================================================================
 *
 * When entity schemas change over time, you need to handle multiple versions.
 * This approach embeds version information in the data structure.
 *
 * Pros:
 * - Explicit schema versioning
 * - Can handle breaking changes gracefully
 * - Historical data remains valid
 *
 * Cons:
 * - More complex type definitions
 * - Requires migration logic for old data
 * - Version field takes up space in every entry
 */

// Version 1 of UserData (original)
export interface UserDataV1 {
  _version: 1;
  name: string;
  email: string;
}

// Version 2 of UserData (added role)
export interface UserDataV2 {
  _version: 2;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}

// Version 3 of UserData (split name into firstName/lastName)
export interface UserDataV3 {
  _version: 3;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "user" | "guest";
}

// Union of all versions
export type VersionedUserData = UserDataV1 | UserDataV2 | UserDataV3;

// Current version alias
export type CurrentUserData = UserDataV3;

// Helper to upgrade old versions to current
export function upgradeUserData(data: VersionedUserData): CurrentUserData {
  switch (data._version) {
    case 1:
      return {
        _version: 3,
        firstName: data.name.split(" ")[0] ?? "",
        lastName: data.name.split(" ").slice(1).join(" ") ?? "",
        email: data.email,
        role: "user", // default role for v1 data
      };
    case 2:
      return {
        _version: 3,
        firstName: data.name.split(" ")[0] ?? "",
        lastName: data.name.split(" ").slice(1).join(" ") ?? "",
        email: data.email,
        role: data.role,
      };
    case 3:
      return data;
  }
}

/**
 * =============================================================================
 * APPROACH 4: Zod Schemas (Best for Runtime Validation)
 * =============================================================================
 *
 * Use Zod for runtime validation and type inference.
 * Great when you need to validate data at boundaries (API input, db output).
 *
 * Pros:
 * - Runtime validation catches data issues
 * - Types are inferred from schemas (single source of truth)
 * - Rich validation capabilities (min/max, regex, etc.)
 *
 * Cons:
 * - Adds runtime overhead
 * - Requires additional dependency (zod)
 * - More verbose than simple interfaces
 *
 * To use this approach, install zod: bun add zod
 */

// Uncomment below if you install zod:
//
// import { z } from 'zod';
//
// export const UserDataSchema = z.object({
//   name: z.string().min(1),
//   email: z.string().email(),
//   role: z.enum(['admin', 'user', 'guest']),
//   preferences: z.object({
//     theme: z.enum(['light', 'dark']),
//     notifications: z.boolean(),
//   }).optional(),
// });
//
// // Infer TypeScript type from schema
// export type ZodUserData = z.infer<typeof UserDataSchema>;
//
// // Validate at runtime
// export function validateUserData(data: unknown): ZodUserData {
//   return UserDataSchema.parse(data);
// }

/**
 * =============================================================================
 * APPROACH 5: Generic Type Parameters (Best for Reusable Components)
 * =============================================================================
 *
 * Use generics to create reusable typed components.
 * Great for building type-safe wrappers around the entities client.
 */

import { type Sql } from "./connection";
import { EntitiesClient, type CreateEntityInput, type Entry as BaseEntry } from "./entities";

/**
 * A typed repository for a specific entity type
 * Provides type-safe operations without runtime overhead
 */
export class TypedEntityRepository<T> {
  private client: EntitiesClient;

  constructor(
    private sql: Sql,
    private entityType: string
  ) {
    this.client = new EntitiesClient(sql);
  }

  async create(data: T): Promise<BaseEntry<T>> {
    return this.client.create<T>({ type: this.entityType, data });
  }

  async update(entityId: number, data: T): Promise<BaseEntry<T>> {
    return this.client.update<T>({ entityId, type: this.entityType, data });
  }

  async delete(entityId: number, data: T): Promise<BaseEntry<T>> {
    return this.client.delete<T>({ entityId, type: this.entityType, data });
  }

  async getById(entityId: number): Promise<BaseEntry<T> | null> {
    return this.client.getById<T>(entityId);
  }

  async getAll(): Promise<BaseEntry<T>[]> {
    return this.client.getByType<T>(this.entityType);
  }

  async findByData(query: Partial<T>): Promise<BaseEntry<T>[]> {
    return this.client.findByData<T>(
      this.entityType,
      query as Record<string, unknown>
    );
  }
}

// Factory functions for typed repositories
export function createUserRepository(sql: Sql) {
  return new TypedEntityRepository<UserData>(sql, "user");
}

export function createProductRepository(sql: Sql) {
  return new TypedEntityRepository<ProductData>(sql, "product");
}

export function createOrderRepository(sql: Sql) {
  return new TypedEntityRepository<OrderData>(sql, "order");
}

/**
 * =============================================================================
 * RECOMMENDATION
 * =============================================================================
 *
 * For most projects, we recommend starting with:
 *
 * 1. APPROACH 1 (Simple Type Registry) for basic type safety
 * 2. APPROACH 5 (Typed Repositories) for clean, domain-specific APIs
 *
 * Add APPROACH 3 (Versioned Types) when you need to make breaking schema changes.
 * Add APPROACH 4 (Zod Schemas) if you need runtime validation at API boundaries.
 *
 * The event-sourced nature of the database means old data is never lost,
 * so you can always read historical data and upgrade it in application code.
 */
