-- Third, define schema ownership and set access for our roles

-- Explicitly connect to quailcomp so we don't alter the wrong db
\connect quailcomp

-- Ensure that the schema is owned by quailcomp_owner
ALTER SCHEMA public OWNER TO quailcomp_owner;

-- Remove implicit PUBLIC ("every role") access
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Only allow quailcomp_owner to create tables on the schema
GRANT CREATE ON SCHEMA public TO quailcomp_owner;

-- Allow both quailcomp_owner and quailcomp_app to access the namespace
GRANT USAGE ON SCHEMA public TO quailcomp_owner;
GRANT USAGE ON SCHEMA public TO quailcomp_app;