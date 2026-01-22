/**
 * Type System Tests
 *
 * These tests verify the TypeScript type definitions and typed repository pattern.
 * They focus on compile-time type safety and runtime behavior of the typing approaches.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { SQL } from "bun";
import {
  TypedEntityRepository,
  createUserRepository,
  type UserData,
  type ProductData,
  upgradeUserData,
  type UserDataV1,
  type UserDataV2,
} from "../src/db/types";

const TEST_DB_NAME = process.env.DB_TEST_NAME ?? "quailcomp_test";

let sql: SQL;

beforeAll(async () => {
  const password = process.env.DB_PASSWORD ?? "";
  const auth = password ? `quailcomp_app:${password}` : "quailcomp_app";

  sql = new SQL({
    url: `postgres://${auth}@localhost:5432/${TEST_DB_NAME}`,
  });
});

afterAll(async () => {
  await sql.close();
});

// =============================================================================
// Typed Repository Tests
// =============================================================================

describe("Typed Repository Pattern", () => {
  it("should create a typed repository", () => {
    const userRepo = createUserRepository(sql);
    expect(userRepo).toBeInstanceOf(TypedEntityRepository);
  });

  it("should create entities with correct types", async () => {
    const userRepo = createUserRepository(sql);

    const user = await userRepo.create({
      name: "Typed User",
      email: "typed@example.com",
      role: "user",
    });

    // TypeScript knows user.data is UserData
    expect(user.data.name).toBe("Typed User");
    expect(user.data.email).toBe("typed@example.com");
    expect(user.data.role).toBe("user");
    expect(user.type).toBe("user");
  });

  it("should update entities with type safety", async () => {
    const userRepo = createUserRepository(sql);

    const created = await userRepo.create({
      name: "Original Name",
      email: "original@example.com",
      role: "user",
    });

    const updated = await userRepo.update(created.entityId, {
      name: "Updated Name",
      email: "updated@example.com",
      role: "admin",
    });

    expect(updated.data.name).toBe("Updated Name");
    expect(updated.data.role).toBe("admin");
  });

  it("should query with type inference", async () => {
    const uniqueSuffix = Date.now();
    const userRepo = new TypedEntityRepository<UserData>(
      sql,
      `typed_user_${uniqueSuffix}`
    );

    await userRepo.create({
      name: "Queryable User",
      email: "query@example.com",
      role: "guest",
    });

    const users = await userRepo.getAll();

    // TypeScript knows users is Entry<UserData>[]
    expect(users[0].data.email).toBe("query@example.com");
    expect(users[0].data.role).toBe("guest");
  });

  it("should search with type-safe queries", async () => {
    const uniqueSuffix = Date.now();
    const userRepo = new TypedEntityRepository<UserData>(
      sql,
      `search_user_${uniqueSuffix}`
    );

    await userRepo.create({
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    });

    await userRepo.create({
      name: "Regular User",
      email: "regular@example.com",
      role: "user",
    });

    // TypeScript ensures we can only search by valid UserData properties
    const admins = await userRepo.findByData({ role: "admin" });

    expect(admins).toHaveLength(1);
    expect(admins[0].data.name).toBe("Admin User");
  });
});

// =============================================================================
// Versioned Types Tests
// =============================================================================

describe("Versioned Types", () => {
  it("should upgrade UserDataV1 to current version", () => {
    const v1Data: UserDataV1 = {
      _version: 1,
      name: "John Doe",
      email: "john@example.com",
    };

    const upgraded = upgradeUserData(v1Data);

    expect(upgraded._version).toBe(3);
    expect(upgraded.firstName).toBe("John");
    expect(upgraded.lastName).toBe("Doe");
    expect(upgraded.email).toBe("john@example.com");
    expect(upgraded.role).toBe("user"); // default role
  });

  it("should upgrade UserDataV2 to current version", () => {
    const v2Data: UserDataV2 = {
      _version: 2,
      name: "Jane Smith",
      email: "jane@example.com",
      role: "admin",
    };

    const upgraded = upgradeUserData(v2Data);

    expect(upgraded._version).toBe(3);
    expect(upgraded.firstName).toBe("Jane");
    expect(upgraded.lastName).toBe("Smith");
    expect(upgraded.role).toBe("admin"); // preserved from v2
  });

  it("should handle single-word names in upgrade", () => {
    const v1Data: UserDataV1 = {
      _version: 1,
      name: "Madonna",
      email: "madonna@example.com",
    };

    const upgraded = upgradeUserData(v1Data);

    expect(upgraded.firstName).toBe("Madonna");
    expect(upgraded.lastName).toBe("");
  });

  it("should handle multi-word last names in upgrade", () => {
    const v1Data: UserDataV1 = {
      _version: 1,
      name: "Mary Jane Watson",
      email: "mj@example.com",
    };

    const upgraded = upgradeUserData(v1Data);

    expect(upgraded.firstName).toBe("Mary");
    expect(upgraded.lastName).toBe("Jane Watson");
  });
});

// =============================================================================
// Generic Type Parameter Tests
// =============================================================================

describe("Generic Type Parameters", () => {
  it("should work with custom entity types", async () => {
    interface CustomEntity {
      field1: string;
      field2: number;
      nested: {
        a: boolean;
        b: string[];
      };
    }

    const uniqueSuffix = Date.now();
    const customRepo = new TypedEntityRepository<CustomEntity>(
      sql,
      `custom_${uniqueSuffix}`
    );

    const created = await customRepo.create({
      field1: "value1",
      field2: 42,
      nested: {
        a: true,
        b: ["x", "y", "z"],
      },
    });

    expect(created.data.field1).toBe("value1");
    expect(created.data.field2).toBe(42);
    expect(created.data.nested.a).toBe(true);
    expect(created.data.nested.b).toEqual(["x", "y", "z"]);
  });

  it("should maintain type safety across operations", async () => {
    interface StrictEntity {
      requiredField: string;
      optionalField?: number;
    }

    const uniqueSuffix = Date.now();
    const repo = new TypedEntityRepository<StrictEntity>(
      sql,
      `strict_${uniqueSuffix}`
    );

    // Create with required field only
    const minimal = await repo.create({
      requiredField: "required",
    });

    expect(minimal.data.requiredField).toBe("required");
    expect(minimal.data.optionalField).toBeUndefined();

    // Update with optional field
    const full = await repo.update(minimal.entityId, {
      requiredField: "still required",
      optionalField: 123,
    });

    expect(full.data.optionalField).toBe(123);
  });
});
