-- Terminates all active connections to the quailcomp database
-- Safe to run multiple times (no-op if no connections exist)
-- Required before dropping the database

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'quailcomp'
  AND pid <> pg_backend_pid();
