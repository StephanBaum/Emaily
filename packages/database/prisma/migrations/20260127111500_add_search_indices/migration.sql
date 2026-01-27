-- Migration: Add full-text search indices for Email table
-- This migration creates:
-- 1. A GIN index on the searchVector tsvector column for efficient full-text search
-- 2. A trigger function to automatically populate searchVector from subject, sender, and body
-- 3. A trigger to keep searchVector updated on INSERT/UPDATE

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_email_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english',
    coalesce(NEW.subject, '') || ' ' ||
    coalesce(NEW.sender, '') || ' ' ||
    coalesce(NEW.body, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update searchVector on INSERT or UPDATE
DROP TRIGGER IF EXISTS email_search_vector_update ON "Email";
CREATE TRIGGER email_search_vector_update
  BEFORE INSERT OR UPDATE OF subject, sender, body
  ON "Email"
  FOR EACH ROW
  EXECUTE FUNCTION update_email_search_vector();

-- Create GIN index on searchVector for fast full-text search
CREATE INDEX IF NOT EXISTS "Email_searchVector_idx" ON "Email" USING GIN ("searchVector");

-- Populate searchVector for existing records
UPDATE "Email"
SET "searchVector" = to_tsvector('english',
  coalesce(subject, '') || ' ' ||
  coalesce(sender, '') || ' ' ||
  coalesce(body, '')
)
WHERE "searchVector" IS NULL;
