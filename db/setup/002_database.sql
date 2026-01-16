-- Second, create the database with our roles and specify privileges

-- Our database is quailcomp and is owned by quailcomp_owner
CREATE DATABASE quailcomp OWNER quailcomp_owner;

-- PUBLIC ("every role") has permissive default privileges
-- We revoke all of them to enforce explicit access
REVOKE ALL ON DATABASE quailcomp FROM PUBLIC;

-- We grant explicit access to quailcomp_app to connect to the db
GRANT CONNECT ON DATABASE quailcomp TO quailcomp_app;
