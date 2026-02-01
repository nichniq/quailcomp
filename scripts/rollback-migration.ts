#!/usr/bin/env bun
/**
 * Rollback a database migration.
 *
 * Usage:
 *   bun run scripts/rollback-migration.ts 003
 *   bun run scripts/rollback-migration.ts all
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { SQL } from "bun";

/**
 * Get database connection from environment
 */
function getConnection(): SQL {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Example: postgres://quailcomp_app:password@localhost/quailcomp"
    );
  }
  return new SQL({ url: databaseUrl });
}

/**
 * Rollback a single migration
 */
async function rollbackMigration(migrationNumber: string): Promise<void> {
  const sql = getConnection();

  try {
    // Find down migration file
    const migrationsDir = "data/postgres/migrations";
    const files = readdirSync(migrationsDir);

    const downFile = files.find(
      (f) =>
        f.startsWith(`${migrationNumber}_`) && f.endsWith("_down.sql")
    );

    if (!downFile) {
      console.error(`❌ No down migration found for ${migrationNumber}`);
      console.log(`   Looking for: ${migrationNumber}_*_down.sql`);
      console.log(`   Available down migrations:`);
      const downFiles = files.filter((f) => f.endsWith("_down.sql"));
      downFiles.forEach((f) => console.log(`     - ${f}`));
      process.exit(1);
    }

    const downPath = `${migrationsDir}/${downFile}`;

    console.log(`📦 Rolling back migration ${migrationNumber}: ${downFile}`);

    // Read and execute down migration
    const migrationSql = readFileSync(downPath, "utf-8");

    await sql.unsafe(migrationSql);

    console.log(
      `✅ Successfully rolled back migration ${migrationNumber}`
    );
  } catch (error) {
    console.error(
      `❌ Failed to rollback migration ${migrationNumber}:`,
      error
    );
    process.exit(1);
  } finally {
    await sql.end();
  }
}

/**
 * Rollback all migrations in reverse order
 */
async function rollbackAll(): Promise<void> {
  const sql = getConnection();

  try {
    // Get all down migrations in reverse order
    const migrationsDir = "data/postgres/migrations";
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith("_down.sql"))
      .sort()
      .reverse(); // Rollback in reverse order

    if (files.length === 0) {
      console.log("No down migrations found.");
      return;
    }

    console.log(`📦 Rolling back ${files.length} migrations...`);

    for (const file of files) {
      console.log(`   - ${file}`);
      const migrationSql = readFileSync(
        `${migrationsDir}/${file}`,
        "utf-8"
      );
      await sql.unsafe(migrationSql);
    }

    console.log(`✅ Successfully rolled back all migrations`);
  } catch (error) {
    console.error(`❌ Failed to rollback migrations:`, error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Main
const migrationNumber = process.argv[2];

if (!migrationNumber) {
  console.error(
    "Usage: bun run scripts/rollback-migration.ts <number|all>"
  );
  console.error("");
  console.error("Examples:");
  console.error("  bun run scripts/rollback-migration.ts 003");
  console.error("  bun run scripts/rollback-migration.ts all");
  process.exit(1);
}

if (migrationNumber === "all") {
  await rollbackAll();
} else {
  await rollbackMigration(migrationNumber.padStart(3, "0"));
}
