-- Second, create the database with our roles and specify privileges

-- Our database is quailcomp and is owned by quailcomp_owner
-- Don't create if the db exists (this makes the query idempotent)
DO $$
BEGIN
    CREATE DATABASE quailcomp OWNER quailcomp_owner;
EXCEPTION
  WHEN duplicate_database THEN NULL;
END
$$;

-- Ensure that the database owner is quailcomp_owner
-- We include this in case the db exists and skips the above creation
ALTER DATABASE quailcomp OWNER TO quailcomp_owner;

-- PUBLIC ("every role") has permissive default privileges
-- We revoke all of them to enforce explicit access
REVOKE ALL ON DATABASE quailcomp FROM PUBLIC;

-- We grant explicit access to quailcomp_app to connect to the db
GRANT CONNECT ON DATABASE quailcomp TO quailcomp_app;
