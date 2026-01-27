/**
 * Test database setup script
 *
 * Creates the test database and runs migrations.
 * Run with: bun run db:setup
 *
 * This script connects as the superuser to create the database,
 * then uses the migration runner to apply all migrations.
 */

import { SQL } from "bun";

const TEST_DB_NAME = process.env.DB_TEST_NAME ?? "quailcomp_test";
const SUPERUSER = process.env.DB_SUPERUSER ?? process.env.USER ?? "postgres";

async function setup() {
  console.log(`Setting up test database: ${TEST_DB_NAME}`);

  // Connect as superuser to create the test database
  const adminSql = new SQL({
    url: `postgres://${SUPERUSER}@localhost:5432/postgres`,
  });

  try {
    // Drop test database if it exists (for clean slate)
    console.log("Dropping existing test database if exists...");
    await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);

    // Create test database owned by quailcomp_owner
    console.log("Creating test database...");
    await adminSql.unsafe(
      `CREATE DATABASE ${TEST_DB_NAME} OWNER quailcomp_owner`
    );

    console.log("Test database created successfully");
  } finally {
    await adminSql.close();
  }

  // Connect to test database as superuser to set up schema
  const testSql = new SQL({
    url: `postgres://${SUPERUSER}@localhost:5432/${TEST_DB_NAME}`,
  });

  try {
    // Set up schema ownership (same as setup/003_schemas.sql)
    console.log("Setting up schema...");
    await testSql.unsafe(`ALTER SCHEMA public OWNER TO quailcomp_owner`);
    await testSql.unsafe(`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
    await testSql.unsafe(`GRANT CREATE ON SCHEMA public TO quailcomp_owner`);
    await testSql.unsafe(`GRANT USAGE ON SCHEMA public TO quailcomp_owner`);
    await testSql.unsafe(`GRANT USAGE ON SCHEMA public TO quailcomp_app`);

    // Set up privileges (same as setup/004_privileges.sql)
    console.log("Setting up privileges...");
    await testSql.unsafe(
      `GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO quailcomp_app`
    );
    await testSql.unsafe(
      `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO quailcomp_app`
    );
    await testSql.unsafe(`
      ALTER DEFAULT PRIVILEGES FOR ROLE quailcomp_owner IN SCHEMA public
      GRANT SELECT, INSERT ON TABLES TO quailcomp_app
    `);
    await testSql.unsafe(`
      ALTER DEFAULT PRIVILEGES FOR ROLE quailcomp_owner IN SCHEMA public
      GRANT USAGE ON SEQUENCES TO quailcomp_app
    `);

    console.log("Schema setup completed successfully");
  } finally {
    await testSql.close();
  }

  // Run migrations via shell script
  console.log("Running migrations...");

  const migrateResult = Bun.spawnSync(
    ["bash", "../../postgres/migrations/run.sh"],
    {
      cwd: import.meta.dir,
      env: { ...process.env, PGDATABASE: TEST_DB_NAME },
      stdout: "inherit",
      stderr: "inherit",
    }
  );

  if (migrateResult.exitCode !== 0) {
    throw new Error("Migrations failed");
  }

  console.log("\n✅ Test database setup complete!");
  console.log(`   Database: ${TEST_DB_NAME}`);
  console.log(`   User: quailcomp_app`);
  console.log(`\nRun tests with: bun test`);
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
