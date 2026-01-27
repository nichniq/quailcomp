/**
 * Run migrations on existing database
 *
 * This script is a thin wrapper around data/postgres/migrations/run.sh
 * It allows running migrations via `bun run db:migrate` from anywhere in the project.
 *
 * Defaults to "quailcomp" (development database). The test database migrations
 * are handled automatically by setup-test-db.ts during test runs.
 */

const DB_NAME = process.env.DB_NAME ?? "quailcomp";

console.log(`Running migrations on database: ${DB_NAME}`);

const migrateResult = Bun.spawnSync(
  ["bash", "../../postgres/migrations/run.sh"],
  {
    cwd: import.meta.dir,
    env: { ...process.env, PGDATABASE: DB_NAME },
    stdout: "inherit",
    stderr: "inherit",
  }
);

if (migrateResult.exitCode !== 0) {
  console.error("Migration failed");
  process.exit(1);
}

console.log("✅ All migrations completed successfully!");
