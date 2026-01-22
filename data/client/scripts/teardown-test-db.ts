/**
 * Test database teardown script
 *
 * Drops the test database.
 * Run with: bun run db:teardown
 */

import { SQL } from "bun";

const TEST_DB_NAME = process.env.DB_TEST_NAME ?? "quailcomp_test";
const SUPERUSER = process.env.DB_SUPERUSER ?? process.env.USER ?? "postgres";

async function teardown() {
  console.log(`Tearing down test database: ${TEST_DB_NAME}`);

  const adminSql = new SQL({
    url: `postgres://${SUPERUSER}@localhost:5432/postgres`,
  });

  try {
    // Terminate existing connections to the test database
    await adminSql.unsafe(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${TEST_DB_NAME}'
      AND pid <> pg_backend_pid()
    `);

    // Drop the test database
    await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);

    console.log("✅ Test database dropped successfully");
  } finally {
    await adminSql.close();
  }
}

teardown().catch((err) => {
  console.error("Teardown failed:", err);
  process.exit(1);
});
