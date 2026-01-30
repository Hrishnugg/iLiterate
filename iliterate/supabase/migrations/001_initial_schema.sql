-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    native_language TEXT NOT NULL,
    target_language TEXT NOT NULL,
    age_group TEXT,  -- 'child', 'teen', 'adult'
    education_level TEXT,  -- 'elementary', 'middle', 'high', 'college', 'graduate'
    years_learning INTEGER DEFAULT 0,
    learning_motivation TEXT[],  -- ['travel', 'career', 'academic', 'personal']
    proficiency_level TEXT DEFAULT 'beginner',  -- 'beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streak tracking
CREATE TABLE streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    streak_start_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content library
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    language TEXT NOT NULL,
    difficulty_level TEXT NOT NULL,  -- 'A1', 'A2', 'B1', 'B2', 'C1', 'C2' (CEFR)
    content_type TEXT,  -- 'article', 'story', 'news', 'dialogue', 'menu', 'sign'
    topic_tags TEXT[],
    word_count INTEGER,
    estimated_reading_time INTEGER,  -- minutes
    source_url TEXT,
    is_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's reading progress
CREATE TABLE reading_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_position INTEGER DEFAULT 0,
    wpm_setting INTEGER DEFAULT 200,
    UNIQUE(user_id, content_id)
);

-- Vocabulary/words encountered
CREATE TABLE vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL,
    language TEXT NOT NULL,
    pronunciation TEXT,
    definitions JSONB,
    part_of_speech TEXT,
    frequency_rank INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(word, language)
);

-- User's highlighted/saved words (flashcards)
CREATE TABLE user_vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id),
    context_sentence TEXT,

    -- Spaced repetition fields (SM-2 algorithm)
    ease_factor DECIMAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review_date DATE DEFAULT CURRENT_DATE,

    -- Stats
    times_reviewed INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, vocabulary_id)
);

-- Quiz/knowledge check results
CREATE TABLE quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id),
    quiz_type TEXT,  -- 'comprehension', 'vocabulary', 'grammar'
    score DECIMAL,
    max_score DECIMAL,
    questions_answered INTEGER,
    time_taken_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User uploaded images
CREATE TABLE user_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    extracted_text TEXT,
    language_detected TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_uploads ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Streaks: users can manage their own streaks
CREATE POLICY "Users can view own streaks" ON streaks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own streaks" ON streaks
    FOR ALL USING (auth.uid() = user_id);

-- Content: all authenticated users can read
CREATE POLICY "Authenticated users can view content" ON content
    FOR SELECT TO authenticated USING (true);

-- Reading progress: users can manage their own
CREATE POLICY "Users can manage own reading progress" ON reading_progress
    FOR ALL USING (auth.uid() = user_id);

-- Vocabulary: all authenticated users can read, insert
CREATE POLICY "Authenticated users can view vocabulary" ON vocabulary
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert vocabulary" ON vocabulary
    FOR INSERT TO authenticated WITH CHECK (true);

-- User vocabulary: users can manage their own
CREATE POLICY "Users can manage own vocabulary" ON user_vocabulary
    FOR ALL USING (auth.uid() = user_id);

-- Quiz results: users can manage their own
CREATE POLICY "Users can manage own quiz results" ON quiz_results
    FOR ALL USING (auth.uid() = user_id);

-- User uploads: users can manage their own
CREATE POLICY "Users can manage own uploads" ON user_uploads
    FOR ALL USING (auth.uid() = user_id);
