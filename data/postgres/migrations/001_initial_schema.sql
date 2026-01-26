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
  entity_id BIGINT NOT NULL,
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
-- This trigger validates that entity_id values follow the correct pattern:
-- - New entities: Must use nextval('entity_id_seq') to get a fresh ID
-- - Updates/Deletes: Must use an existing entity_id
--
-- The client is responsible for:
-- - Creating: INSERT with entity_id = nextval('entity_id_seq')
-- - Updating: INSERT with entity_id = <existing_id>
--
-- The trigger rejects inserts where entity_id doesn't exist and wasn't
-- just allocated by the sequence (detected by checking if it matches currval).
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_entity_id()
RETURNS TRIGGER AS $$
DECLARE
  id_exists BOOLEAN;
  seq_val BIGINT;
BEGIN
  -- Check if the entity_id already exists in the table
  SELECT EXISTS(SELECT 1 FROM entities WHERE entity_id = NEW.entity_id)
  INTO id_exists;

  IF id_exists THEN
    -- This is an UPDATE to an existing entity - allowed
    RETURN NEW;
  ELSE
    -- Entity doesn't exist - verify this is a fresh sequence value
    -- Get current sequence value (what was last returned by nextval in this session)
    BEGIN
      seq_val := currval('entity_id_seq');
      IF NEW.entity_id = seq_val THEN
        -- This is a new entity using the sequence correctly
        RETURN NEW;
      ELSE
        -- entity_id doesn't match the sequence - reject
        RAISE EXCEPTION 'entity_id % does not exist. For new entities, use nextval(''entity_id_seq''). For updates, use an existing entity_id.', NEW.entity_id;
      END IF;
    EXCEPTION WHEN object_not_in_prerequisite_state THEN
      -- nextval hasn't been called in this session - reject
      RAISE EXCEPTION 'entity_id % does not exist and no sequence value was obtained. For new entities, use nextval(''entity_id_seq'').', NEW.entity_id;
    END;
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

-- ============================================================================
-- EVENTS TABLE - Event-sourced append-only log of facts
-- ============================================================================
--
-- Design goals:
-- 1. Append-only: Entries are immutable and never updated or deleted
-- 2. Event sourcing: Each entry represents a point-in-time snapshot of an event
-- 3. Time-ordered: Events capture when things happened (occurred_at)
-- 4. Enrichable: Event data can be "updated" by appending new entries
-- 5. Flexible schema: JSONB data field allows arbitrary event structure
--
-- Table structure:
-- - entry_id: Unique, auto-incremented ID for each immutable entry
-- - entered_at: Timestamp when this entry was created in the database
-- - event_type: Type of event (e.g., 'book_acquired', 'book_lent')
-- - occurred_at: When the event actually happened in the real world
-- - data: JSONB containing event details (entity refs, amounts, annotations, etc.)
-- - event_id: Logical event identifier (multiple entries share same event_id)
-- - voided_at: NULL for active events, timestamp when event was voided/cancelled
--
-- Usage pattern:
-- - Recording new event: INSERT with event_id from sequence - gets new event_id
-- - Enriching event: INSERT with existing event_id - adds annotations/corrections
-- - Voiding event: INSERT with (event_id, voided_at) - marks as cancelled
-- - Querying latest state: SELECT * WHERE event_id = X ORDER BY entered_at DESC LIMIT 1
-- - Querying timeline: SELECT latest by event_id ORDER BY occurred_at
-- - Finding events for entity: SELECT * WHERE data @> '{"book_id": "123"}'
--
-- Key distinction from entities:
-- - Entities represent things that exist (nouns) - their state changes over time
-- - Events represent facts that happened (verbs) - immutable but enrichable
-- - occurred_at is fixed (when it happened), entered_at tracks data changes
--
-- Known or potential issues:
-- - Event types are not currently constrained
-- - No foreign key constraints to entities (flexible but less safe)
-- - Race condition possible if adding/checking simultaneously (same as entities)
-- ============================================================================

CREATE SEQUENCE event_id_seq;

CREATE TABLE events (
  entry_id BIGSERIAL PRIMARY KEY,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  event_type VARCHAR(100) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  event_id BIGINT NOT NULL,
  voided_at TIMESTAMPTZ DEFAULT NULL
);

-- Primary use case: Get latest version of active (non-voided) events
-- Partial index significantly reduces index size and improves query performance
CREATE INDEX idx_events_active ON events (event_id, entered_at DESC) WHERE voided_at IS NULL;

-- Index for time-series queries by occurred_at (when things actually happened)
CREATE INDEX idx_events_occurred ON events (occurred_at DESC) WHERE voided_at IS NULL;

-- Index for querying by event type and time
CREATE INDEX idx_events_type_occurred ON events (event_type, occurred_at DESC) WHERE voided_at IS NULL;

-- Index for JSONB queries (finding events about specific entities)
CREATE INDEX idx_events_data_gin ON events USING GIN (data) WHERE voided_at IS NULL;

ALTER SEQUENCE event_id_seq OWNED BY events.event_id;

-- ============================================================================
-- EVENT_ID VALIDATION TRIGGER
-- ============================================================================
-- This trigger validates that event_id values follow the correct pattern:
-- - New events: Must use nextval('event_id_seq') to get a fresh ID
-- - Updates/Enrichments: Must use an existing event_id
--
-- The client is responsible for:
-- - Recording: INSERT with event_id = nextval('event_id_seq')
-- - Enriching: INSERT with event_id = <existing_id>
--
-- The trigger rejects inserts where event_id doesn't exist and wasn't
-- just allocated by the sequence (detected by checking if it matches currval).
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_event_id()
RETURNS TRIGGER AS $$
DECLARE
  id_exists BOOLEAN;
  seq_val BIGINT;
BEGIN
  -- Check if the event_id already exists in the table
  SELECT EXISTS(SELECT 1 FROM events WHERE event_id = NEW.event_id)
  INTO id_exists;

  IF id_exists THEN
    -- This is an enrichment to an existing event - allowed
    RETURN NEW;
  ELSE
    -- Event doesn't exist - verify this is a fresh sequence value
    -- Get current sequence value (what was last returned by nextval in this session)
    BEGIN
      seq_val := currval('event_id_seq');
      IF NEW.event_id = seq_val THEN
        -- This is a new event using the sequence correctly
        RETURN NEW;
      ELSE
        -- event_id doesn't match the sequence - reject
        RAISE EXCEPTION 'event_id % does not exist. For new events, use nextval(''event_id_seq''). For enrichments, use an existing event_id.', NEW.event_id;
      END IF;
    EXCEPTION WHEN object_not_in_prerequisite_state THEN
      -- nextval hasn't been called in this session - reject
      RAISE EXCEPTION 'event_id % does not exist and no sequence value was obtained. For new events, use nextval(''event_id_seq'').', NEW.event_id;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_event_id
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION validate_event_id();

-- ============================================================================
-- REQUIRED PERMISSIONS
-- ============================================================================
-- For a role to interact with this table, the following permissions are needed:
--
-- 1. Schema access:
--    GRANT USAGE ON SCHEMA public TO <role>;
--
-- 2. Table operations (append-only pattern):
--    GRANT SELECT, INSERT ON events TO <role>;
--    (Note: UPDATE and DELETE are intentionally omitted for immutability)
--
-- 3. Sequence operations (required by trigger and BIGSERIAL):
--    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO <role>;
--    - Covers event_id_seq (explicit) and events_entry_id_seq (auto-generated)
--    - Required because the validate_event_id() trigger executes as the inserting
--      user and calls nextval() on event_id_seq
--
-- All permissions are granted at the setup level in db/setup/004_privileges.sql
-- using both immediate grants (for existing objects) and default privileges
-- (for future objects). No per-table permission grants are needed.
-- ============================================================================
