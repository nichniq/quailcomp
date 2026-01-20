-- ============================================================================
-- ENTITIES TABLE - Event-sourced append-only data store
-- ============================================================================
--
-- Design goals:
-- 1. Append-only: Entries are immutable and never updated or deleted
-- 2. Event sourcing: Each entry represents a point-in-time snapshot of an entity
-- 3. Flexible schema: JSONB data field allows arbitrary structure per entity type
-- 4. Auto-sequencing: New entities get auto-generated IDs, updates reuse existing IDs
-- 5. Soft deletes: Entities marked deleted via deleted_at timestamp, data preserved
--
-- Table structure:
-- - entry_id: Unique, auto-incremented ID for each immutable entry
-- - entered_at: Timestamp when this entry was created
-- - type: Entity type (e.g., 'user', 'order', 'product')
-- - data: Flexible JSONB field containing entity state at this point in time
-- - entity_id: Logical entity identifier (multiple entries share same entity_id)
-- - deleted_at: NULL for active entities, timestamp when entity was soft-deleted
--
-- Usage pattern:
-- - Creating new entity: INSERT with only (type, data) - gets new entity_id
-- - Updating entity: INSERT with (entity_id, type, data) - reuses existing entity_id
-- - Deleting entity: INSERT with (entity_id, type, data, deleted_at) - marks as deleted
-- - Querying latest state: SELECT * WHERE entity_id = X ORDER BY entered_at DESC LIMIT 1
-- - Querying history: SELECT * WHERE entity_id = X ORDER BY entered_at
--
-- Known or potential issues:
-- - Entity types are not currently constrained
-- - There could be a race condition in the trigger if adding/checking simultaneously
-- - There are no constraints on deleted entities so re- and un-deletions are possible
-- - No index for plain entities, querying full history or deleted will be slower
-- ============================================================================

CREATE SEQUENCE entity_id_seq;

CREATE TABLE entities (
  entry_id BIGSERIAL PRIMARY KEY,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  entity_id BIGINT NOT NULL DEFAULT nextval('entity_id_seq'),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Primary use case: Get latest version of active (non-deleted) entities
-- Partial index significantly reduces index size and improves query performance
CREATE INDEX idx_entities_active ON entities (entity_id, entered_at DESC) WHERE deleted_at IS NULL;

-- Index for query by type (get all active entities of a type)
-- Also partial to optimize for the common case
CREATE INDEX idx_entities_type_active ON entities (type, entered_at DESC) WHERE deleted_at IS NULL;

-- Index for general JSONB search on active entities
-- GIN index for flexible queries within the data field
CREATE INDEX idx_entities_data_gin ON entities USING GIN (data) WHERE deleted_at IS NULL;

ALTER SEQUENCE entity_id_seq OWNED BY entities.entity_id;

-- ============================================================================
-- ENTITY_ID VALIDATION TRIGGER
-- ============================================================================
-- This trigger enforces the dual-use pattern for entity_id:
-- 1. New entities: Omit entity_id, get auto-generated value from sequence
-- 2. Updates/Deletes: Provide existing entity_id, sequence is not consumed
--
-- The trigger prevents:
-- - Creating new entities with explicit (non-existent) entity_id values
-- - Wasting sequence numbers when reusing entity_ids for updates
--
-- Implementation:
-- - Always calls nextval() to get the next sequence value
-- - If entity_id matches the sequence value → new entity (keep sequence value)
-- - If entity_id differs → explicit ID provided (rollback sequence, validate exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_entity_id()
RETURNS TRIGGER AS $$
DECLARE
  next_id BIGINT;
  id_exists BOOLEAN;
BEGIN
  -- Get the next sequence value (will be rolled back if not used)
  next_id := nextval('entity_id_seq');

  -- Check if the entity_id that will be used already exists in the table
  SELECT EXISTS(SELECT 1 FROM entities WHERE entity_id = NEW.entity_id)
  INTO id_exists;

  -- Determine if this is a new entity or an update to an existing entity
  IF NEW.entity_id = next_id THEN
    -- entity_id came from the default (nextval), this is a NEW entity
    -- Keep the sequence value and proceed
    RETURN NEW;
  ELSE
    -- entity_id was explicitly provided, this is an UPDATE or DELETE
    -- Roll back the sequence since we're not using this number
    PERFORM setval('entity_id_seq', next_id - 1, true);

    -- Verify the provided entity_id actually exists (prevent orphaned updates)
    IF NOT id_exists THEN
      RAISE EXCEPTION 'entity_id % does not exist. To add an entry for an existing entity, use a valid entity_id. For new entities, omit entity_id to auto-generate.', NEW.entity_id;
    END IF;

    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_entity_id
  BEFORE INSERT ON entities
  FOR EACH ROW
  EXECUTE FUNCTION validate_entity_id();

-- ============================================================================
-- REQUIRED PERMISSIONS
-- ============================================================================
-- For a role to interact with this table, the following permissions are needed:
--
-- 1. Schema access:
--    GRANT USAGE ON SCHEMA public TO <role>;
--
-- 2. Table operations (append-only pattern):
--    GRANT SELECT, INSERT ON entities TO <role>;
--    (Note: UPDATE and DELETE are intentionally omitted for immutability)
--
-- 3. Sequence operations (required by trigger and BIGSERIAL):
--    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO <role>;
--    - Covers entity_id_seq (explicit) and entities_entry_id_seq (auto-generated)
--    - Required because the validate_entity_id() trigger executes as the inserting
--      user and calls nextval() and setval() on entity_id_seq
--
-- All permissions are granted at the setup level in db/setup/004_privileges.sql
-- using both immediate grants (for existing objects) and default privileges
-- (for future objects). No per-table permission grants are needed.
-- ============================================================================
