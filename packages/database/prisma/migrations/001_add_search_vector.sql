-- Add tsvector column to emails for full-text search
-- Run with: psql $DATABASE_URL -f 001_add_search_vector.sql

-- Add tsvector column
ALTER TABLE emails ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate for existing emails
UPDATE emails SET search_vector =
  setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(from_name, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(from_address, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(body_text, '')), 'C')
WHERE search_vector IS NULL;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_emails_search_vector ON emails USING GIN(search_vector);

-- Auto-update trigger on insert/update
CREATE OR REPLACE FUNCTION emails_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.from_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.from_address, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS emails_search_vector_trigger ON emails;
CREATE TRIGGER emails_search_vector_trigger
  BEFORE INSERT OR UPDATE OF subject, body_text, from_name, from_address
  ON emails
  FOR EACH ROW
  EXECUTE FUNCTION emails_search_vector_update();
