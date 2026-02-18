-- Migration: 004_user_skill_levels.sql
-- Description: Add skill-based progress tracking with 1-20 levels mapped to CEFR

-- ============================================================================
-- 1. User Skill Levels Table
-- ============================================================================
CREATE TABLE user_skill_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Individual skill levels (1-20 scale)
    reading_level INTEGER NOT NULL DEFAULT 1 CHECK (reading_level >= 1 AND reading_level <= 20),
    vocabulary_level INTEGER NOT NULL DEFAULT 1 CHECK (vocabulary_level >= 1 AND vocabulary_level <= 20),
    grammar_level INTEGER NOT NULL DEFAULT 1 CHECK (grammar_level >= 1 AND grammar_level <= 20),

    -- XP tracking for progress within each level
    reading_xp INTEGER NOT NULL DEFAULT 0 CHECK (reading_xp >= 0),
    vocabulary_xp INTEGER NOT NULL DEFAULT 0 CHECK (vocabulary_xp >= 0),
    grammar_xp INTEGER NOT NULL DEFAULT 0 CHECK (grammar_xp >= 0),

    -- Custom weights for overall level calculation (must sum to ~1.0)
    reading_weight DECIMAL(3,2) NOT NULL DEFAULT 0.34 CHECK (reading_weight >= 0 AND reading_weight <= 1),
    vocabulary_weight DECIMAL(3,2) NOT NULL DEFAULT 0.33 CHECK (vocabulary_weight >= 0 AND vocabulary_weight <= 1),
    grammar_weight DECIMAL(3,2) NOT NULL DEFAULT 0.33 CHECK (grammar_weight >= 0 AND grammar_weight <= 1),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One record per user
    UNIQUE(user_id),

    -- Weights must sum to approximately 1.0 (allowing for floating point)
    CONSTRAINT weights_sum_to_one CHECK (
        reading_weight + vocabulary_weight + grammar_weight >= 0.99
        AND reading_weight + vocabulary_weight + grammar_weight <= 1.01
    )
);

-- Index for quick lookups
CREATE INDEX idx_user_skill_levels_user_id ON user_skill_levels(user_id);

-- RLS policies
ALTER TABLE user_skill_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skill levels"
    ON user_skill_levels FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own skill levels"
    ON user_skill_levels FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skill levels"
    ON user_skill_levels FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. Skill Assessments Table (Quiz/Test Results)
-- ============================================================================
CREATE TABLE skill_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE SET NULL,

    -- Assessment metadata
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('post_reading', 'level_check', 'placement')),

    -- Detailed question results stored as JSON
    -- Format: [{"id": "q1", "type": "comprehension_mcq", "question": "...", "correct_answer": "A", "user_answer": "B", "correct": false}, ...]
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Skill-specific scores (nullable for assessments that don't test all skills)
    reading_score DECIMAL(5,2),
    reading_max_score DECIMAL(5,2),
    vocabulary_score DECIMAL(5,2),
    vocabulary_max_score DECIMAL(5,2),
    grammar_score DECIMAL(5,2),
    grammar_max_score DECIMAL(5,2),

    -- XP awarded from this assessment
    reading_xp_awarded INTEGER NOT NULL DEFAULT 0,
    vocabulary_xp_awarded INTEGER NOT NULL DEFAULT 0,
    grammar_xp_awarded INTEGER NOT NULL DEFAULT 0,

    -- Track level changes triggered by this assessment
    -- Format: {"reading": {"from": 5, "to": 6}, "vocabulary": {"from": 3, "to": 3}}
    level_changes JSONB,

    -- Time tracking
    time_taken_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_skill_assessments_user_id ON skill_assessments(user_id);
CREATE INDEX idx_skill_assessments_content_id ON skill_assessments(content_id);
CREATE INDEX idx_skill_assessments_created_at ON skill_assessments(user_id, created_at DESC);

-- RLS policies
ALTER TABLE skill_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessments"
    ON skill_assessments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments"
    ON skill_assessments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. Generated Content Tracking Table
-- ============================================================================
CREATE TABLE generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE SET NULL,

    -- Generation parameters
    target_cefr_level TEXT NOT NULL CHECK (target_cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    target_numeric_level INTEGER NOT NULL CHECK (target_numeric_level >= 1 AND target_numeric_level <= 20),
    topic_requested TEXT,
    vocabulary_focus TEXT[] DEFAULT '{}',
    grammar_focus TEXT[] DEFAULT '{}',

    -- Metadata for debugging/analytics
    prompt_used TEXT,
    model_used TEXT DEFAULT 'gemini-2.0-flash',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user's generated content
CREATE INDEX idx_generated_content_user_id ON generated_content(user_id, created_at DESC);

-- RLS policies
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated content"
    ON generated_content FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated content"
    ON generated_content FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 4. Modifications to Existing Tables
-- ============================================================================

-- Add numeric_level to content table for finer granularity
ALTER TABLE content ADD COLUMN IF NOT EXISTS numeric_level INTEGER CHECK (numeric_level >= 1 AND numeric_level <= 20);

-- Add placement test tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS placement_test_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS placement_test_date TIMESTAMPTZ;

-- ============================================================================
-- 5. Function to auto-set numeric_level from CEFR difficulty_level
-- ============================================================================
CREATE OR REPLACE FUNCTION set_numeric_level_from_cefr()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set if numeric_level is NULL and difficulty_level is set
    IF NEW.numeric_level IS NULL AND NEW.difficulty_level IS NOT NULL THEN
        NEW.numeric_level := CASE NEW.difficulty_level
            WHEN 'A1' THEN 2   -- Middle of 1-3 range
            WHEN 'A2' THEN 5   -- Middle of 4-6 range
            WHEN 'B1' THEN 8   -- Middle of 7-10 range
            WHEN 'B2' THEN 12  -- Middle of 11-14 range
            WHEN 'C1' THEN 16  -- Middle of 15-17 range
            WHEN 'C2' THEN 19  -- Middle of 18-20 range
            ELSE 5             -- Default to A2 if unknown
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate numeric_level
DROP TRIGGER IF EXISTS auto_set_numeric_level ON content;
CREATE TRIGGER auto_set_numeric_level
    BEFORE INSERT OR UPDATE ON content
    FOR EACH ROW
    EXECUTE FUNCTION set_numeric_level_from_cefr();

-- Backfill existing content with numeric_level
UPDATE content
SET numeric_level = CASE difficulty_level
    WHEN 'A1' THEN 2
    WHEN 'A2' THEN 5
    WHEN 'B1' THEN 8
    WHEN 'B2' THEN 12
    WHEN 'C1' THEN 16
    WHEN 'C2' THEN 19
    ELSE 5
END
WHERE numeric_level IS NULL;

-- ============================================================================
-- 6. Function to calculate overall level (for reference in queries)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_overall_level(
    p_reading_level INTEGER,
    p_vocabulary_level INTEGER,
    p_grammar_level INTEGER,
    p_reading_weight DECIMAL,
    p_vocabulary_weight DECIMAL,
    p_grammar_weight DECIMAL
)
RETURNS INTEGER AS $$
BEGIN
    RETURN FLOOR(
        p_reading_level * p_reading_weight +
        p_vocabulary_level * p_vocabulary_weight +
        p_grammar_level * p_grammar_weight
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 7. View for easy access to user progress with overall level
-- ============================================================================
CREATE OR REPLACE VIEW user_progress_view AS
SELECT
    usl.*,
    calculate_overall_level(
        usl.reading_level,
        usl.vocabulary_level,
        usl.grammar_level,
        usl.reading_weight,
        usl.vocabulary_weight,
        usl.grammar_weight
    ) as overall_level,
    CASE
        WHEN calculate_overall_level(usl.reading_level, usl.vocabulary_level, usl.grammar_level, usl.reading_weight, usl.vocabulary_weight, usl.grammar_weight) <= 3 THEN 'A1'
        WHEN calculate_overall_level(usl.reading_level, usl.vocabulary_level, usl.grammar_level, usl.reading_weight, usl.vocabulary_weight, usl.grammar_weight) <= 6 THEN 'A2'
        WHEN calculate_overall_level(usl.reading_level, usl.vocabulary_level, usl.grammar_level, usl.reading_weight, usl.vocabulary_weight, usl.grammar_weight) <= 10 THEN 'B1'
        WHEN calculate_overall_level(usl.reading_level, usl.vocabulary_level, usl.grammar_level, usl.reading_weight, usl.vocabulary_weight, usl.grammar_weight) <= 14 THEN 'B2'
        WHEN calculate_overall_level(usl.reading_level, usl.vocabulary_level, usl.grammar_level, usl.reading_weight, usl.vocabulary_weight, usl.grammar_weight) <= 17 THEN 'C1'
        ELSE 'C2'
    END as overall_cefr_level
FROM user_skill_levels usl;
