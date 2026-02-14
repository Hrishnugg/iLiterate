-- Migration: Add lesson_id support to highlights and translation_lookups
-- This allows saving highlights and lookups for AI-generated lesson content

-- Add lesson_id to highlights table
ALTER TABLE highlights
ADD COLUMN lesson_id UUID REFERENCES lesson_sessions(id) ON DELETE CASCADE;

-- Make content_id nullable (since we now have lesson_id as alternative)
ALTER TABLE highlights
ALTER COLUMN content_id DROP NOT NULL;

-- Add check constraint: must have either content_id or lesson_id
ALTER TABLE highlights
ADD CONSTRAINT highlights_content_or_lesson_check
CHECK (content_id IS NOT NULL OR lesson_id IS NOT NULL);

-- Add index for lesson lookups
CREATE INDEX idx_highlights_lesson_id ON highlights(lesson_id) WHERE lesson_id IS NOT NULL;

-- Add lesson_id to translation_lookups table
ALTER TABLE translation_lookups
ADD COLUMN lesson_id UUID REFERENCES lesson_sessions(id) ON DELETE CASCADE;

-- Make content_id nullable
ALTER TABLE translation_lookups
ALTER COLUMN content_id DROP NOT NULL;

-- Add check constraint
ALTER TABLE translation_lookups
ADD CONSTRAINT translation_lookups_content_or_lesson_check
CHECK (content_id IS NOT NULL OR lesson_id IS NOT NULL);

-- Add index for lesson lookups
CREATE INDEX idx_translation_lookups_lesson_id ON translation_lookups(lesson_id) WHERE lesson_id IS NOT NULL;

-- Update RLS policies to include lesson access
DROP POLICY IF EXISTS "Users can view their own highlights" ON highlights;
CREATE POLICY "Users can view their own highlights"
    ON highlights FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create highlights" ON highlights;
CREATE POLICY "Users can create highlights"
    ON highlights FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own lookups" ON translation_lookups;
CREATE POLICY "Users can view their own lookups"
    ON translation_lookups FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create lookups" ON translation_lookups;
CREATE POLICY "Users can create lookups"
    ON translation_lookups FOR INSERT
    WITH CHECK (auth.uid() = user_id);
