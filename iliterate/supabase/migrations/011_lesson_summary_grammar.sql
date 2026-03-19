-- Migration: 011_lesson_summary_grammar.sql
-- Description: Add summary and grammar_points columns to lesson_sessions for pre-reading brief

ALTER TABLE lesson_sessions ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE lesson_sessions ADD COLUMN IF NOT EXISTS grammar_points JSONB DEFAULT '[]'::jsonb;
