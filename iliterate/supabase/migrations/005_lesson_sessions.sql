-- Migration: 005_lesson_sessions.sql
-- Description: Add lesson sessions table for AI-generated adaptive lessons

-- ============================================================================
-- 1. Lesson Sessions Table
-- ============================================================================
CREATE TABLE lesson_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Generated content
    title TEXT NOT NULL,
    content_body TEXT NOT NULL,
    target_level INTEGER NOT NULL CHECK (target_level >= 1 AND target_level <= 20),
    topic TEXT,
    length_type TEXT NOT NULL CHECK (length_type IN ('short', 'medium', 'long')),
    word_count INTEGER,

    -- Vocabulary extracted from the lesson
    vocabulary JSONB DEFAULT '[]'::jsonb,
    -- Format: [{"word": "...", "translation": "...", "context": "..."}]

    -- Session state
    status TEXT NOT NULL DEFAULT 'reading' CHECK (status IN ('reading', 'quiz', 'completed')),
    reading_started_at TIMESTAMPTZ DEFAULT NOW(),
    reading_completed_at TIMESTAMPTZ,

    -- Quiz data (populated when quiz is generated)
    quiz_questions JSONB,
    -- Format: same as skill_assessments questions

    -- Results (after completion)
    quiz_answers JSONB, -- User's submitted answers
    quiz_score DECIMAL(5,2),
    quiz_max_score DECIMAL(5,2),
    reading_xp_awarded INTEGER DEFAULT 0,
    vocabulary_xp_awarded INTEGER DEFAULT 0,
    level_adjustment INTEGER DEFAULT 0, -- -1, 0, or +1
    completed_at TIMESTAMPTZ,

    -- AI generation metadata
    prompt_used TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_lesson_sessions_user_id ON lesson_sessions(user_id);
CREATE INDEX idx_lesson_sessions_status ON lesson_sessions(user_id, status);
CREATE INDEX idx_lesson_sessions_created_at ON lesson_sessions(user_id, created_at DESC);

-- RLS policies
ALTER TABLE lesson_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lesson sessions"
    ON lesson_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lesson sessions"
    ON lesson_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lesson sessions"
    ON lesson_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Predefined Topics Table (optional, for topic suggestions)
-- ============================================================================
CREATE TABLE lesson_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- emoji or icon name
    motivation_tags TEXT[] DEFAULT '{}', -- maps to learning_motivation
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert default topics
INSERT INTO lesson_topics (name, display_name, description, icon, motivation_tags, sort_order) VALUES
    ('travel', 'Travel & Tourism', 'Airports, hotels, directions, transportation', '✈️', ARRAY['travel'], 1),
    ('food', 'Food & Dining', 'Restaurants, cooking, recipes, grocery shopping', '🍽️', ARRAY['travel', 'personal'], 2),
    ('daily_life', 'Daily Life', 'Routines, household, shopping, appointments', '🏠', ARRAY['personal'], 3),
    ('culture', 'Culture & Traditions', 'Holidays, customs, art, history', '🎭', ARRAY['personal', 'academic'], 4),
    ('work', 'Work & Career', 'Office, meetings, emails, professions', '💼', ARRAY['career'], 5),
    ('news', 'News & Current Events', 'Headlines, politics, society, environment', '📰', ARRAY['academic', 'career'], 6),
    ('nature', 'Nature & Environment', 'Animals, weather, geography, outdoors', '🌿', ARRAY['personal', 'academic'], 7),
    ('technology', 'Technology', 'Computers, internet, gadgets, innovation', '💻', ARRAY['career', 'personal'], 8),
    ('relationships', 'People & Relationships', 'Family, friends, emotions, social situations', '👥', ARRAY['personal', 'family'], 9),
    ('health', 'Health & Wellness', 'Body, exercise, medicine, well-being', '🏃', ARRAY['personal'], 10),
    ('entertainment', 'Entertainment', 'Movies, music, sports, hobbies', '🎬', ARRAY['entertainment', 'personal'], 11),
    ('education', 'Education & Learning', 'School, studying, books, knowledge', '📚', ARRAY['academic'], 12);

-- RLS for topics (public read)
ALTER TABLE lesson_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active topics"
    ON lesson_topics FOR SELECT
    USING (is_active = TRUE);

-- ============================================================================
-- 3. Function to suggest topic based on user's motivations
-- ============================================================================
CREATE OR REPLACE FUNCTION suggest_lesson_topic(p_user_id UUID)
RETURNS TABLE(topic_name TEXT, topic_display_name TEXT, match_score INTEGER)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lt.name,
        lt.display_name,
        COALESCE(
            (SELECT COUNT(*)::INTEGER
             FROM unnest(lt.motivation_tags) AS tag
             WHERE tag = ANY(
                 (SELECT learning_motivation FROM profiles WHERE id = p_user_id)
             )),
            0
        ) AS match_score
    FROM lesson_topics lt
    WHERE lt.is_active = TRUE
    ORDER BY match_score DESC, lt.sort_order ASC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
