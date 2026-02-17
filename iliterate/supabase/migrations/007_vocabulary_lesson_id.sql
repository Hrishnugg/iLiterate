-- Migration: Add lesson_id support to user_vocabulary
-- This allows flashcards to be associated with AI-generated lessons

-- Add lesson_id to user_vocabulary table
ALTER TABLE user_vocabulary
ADD COLUMN lesson_id UUID REFERENCES lesson_sessions(id) ON DELETE CASCADE;

-- Make content_id nullable (since we now have lesson_id as alternative)
ALTER TABLE user_vocabulary
ALTER COLUMN content_id DROP NOT NULL;

-- Create index for lesson_id lookups
CREATE INDEX idx_user_vocabulary_lesson_id ON user_vocabulary(lesson_id) WHERE lesson_id IS NOT NULL;
