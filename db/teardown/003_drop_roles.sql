-- Drops roles created by setup
-- Order matters: app role first, owner role last

DROP ROLE IF EXISTS quailcomp_app;
DROP ROLE IF EXISTS quailcomp_owner;
