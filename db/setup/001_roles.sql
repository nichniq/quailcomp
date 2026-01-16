-- First, create roles used to establish db ownership and access

-- The quailcomp_owner will own the database but won't access it
-- It can't be used to login (i.e. authenticate or open sessions)
-- It can grant privileges on objects it owns
CREATE ROLE quailcomp_owner NOLOGIN;

-- The quailcomp_app role will be used by the application
-- It requires login and can be used to connect to the database
-- Login credentials shouldn't be committed and will be set per env
CREATE ROLE quailcomp_app LOGIN;
