-- Migration: 016_lesson_topics_array.sql
-- Description: Change lesson_sessions.topic (TEXT) to topics (TEXT[]) to support multi-topic lessons

ALTER TABLE lesson_sessions
  ADD COLUMN topics TEXT[] DEFAULT '{}';

-- Migrate existing single-topic rows into the new array column
UPDATE lesson_sessions
  SET topics = ARRAY[topic]
  WHERE topic IS NOT NULL;

-- Drop the old single-topic column
ALTER TABLE lesson_sessions DROP COLUMN topic;
