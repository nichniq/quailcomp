-- Fourth, establish privileges for the roles on database tables

-- Explicitly connect to quailcomp so we don't alter the wrong db
\connect quailcomp

-- Grant privilege to existing tables to quailcomp_app
-- This will be an append-only database, so only grant SELECT and INSERT
-- Grant for all tables in the public schema
GRANT SELECT, INSERT
ON ALL TABLES IN SCHEMA public
TO quailcomp_app;

-- Set default privileges for future tables to quailcomp_app
ALTER DEFAULT PRIVILEGES -- Alter default privilege granted...
FOR ROLE quailcomp_owner -- For objects created by quailcomp_owner...
IN SCHEMA public         -- In the public schema...
GRANT SELECT, INSERT     -- Grant SELECT and INSERT... (append only)
ON TABLES                -- For tables... (one object kind per ALTER)
TO quailcomp_app;        -- To quailcomp_app
