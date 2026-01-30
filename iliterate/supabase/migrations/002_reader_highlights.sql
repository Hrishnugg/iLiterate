-- Highlights/annotations table for the reader
CREATE TABLE highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    
    -- Text position (robust for different content formats)
    position_type TEXT DEFAULT 'offset', -- 'offset', 'xpath', 'cfi' (for EPUB)
    start_position TEXT NOT NULL,        -- character offset or CFI string
    end_position TEXT NOT NULL,
    selected_text TEXT NOT NULL,
    
    -- Surrounding context (helps with display and re-highlighting)
    context_before TEXT,
    context_after TEXT,
    
    -- User's note (optional)
    note TEXT,
    
    -- Translation data (cached from Gemini)
    translation TEXT,
    transliteration TEXT,
    part_of_speech TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Translation lookups per document (for Recent Lookups panel)
CREATE TABLE translation_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    source_lang TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    transliteration TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_highlights_user_content ON highlights(user_id, content_id);
CREATE INDEX idx_highlights_content ON highlights(content_id);
CREATE INDEX idx_translation_lookups_content_user ON translation_lookups(content_id, user_id, created_at DESC);
CREATE INDEX idx_translation_lookups_user ON translation_lookups(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_lookups ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own highlights
CREATE POLICY "Users can view own highlights" ON highlights
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights" ON highlights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own highlights" ON highlights
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights" ON highlights
    FOR DELETE USING (auth.uid() = user_id);

-- Users can only see/manage their own translation lookups
CREATE POLICY "Users can view own translation lookups" ON translation_lookups
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own translation lookups" ON translation_lookups
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own translation lookups" ON translation_lookups
    FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for highlights updated_at
CREATE TRIGGER update_highlights_updated_at
    BEFORE UPDATE ON highlights
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample content for testing (optional, remove in production)
INSERT INTO content (title, body, language, difficulty_level, content_type, word_count, estimated_reading_time)
VALUES (
    'The Adventure of the Blue Carbuncle',
    '<h2>A Sherlock Holmes Story</h2><p>"I had called upon my friend Sherlock Holmes upon the second morning after Christmas, with the intention of wishing him the compliments of the season. He was lounging upon the sofa in a purple dressing-gown, a pipe-rack within his reach upon the right, and a pile of crumpled morning papers, evidently newly studied, near at hand. Beside the couch was a wooden chair, and on the angle of the back hung a very seedy and disreputable hard-felt hat, much the worse for wear, and cracked in several places.</p><p>"You are engaged," said I; "perhaps I interrupt you."</p><p>"Not at all. I am glad to have a friend with whom I can discuss my results. The matter is a perfectly trivial one"--he jerked his thumb in the direction of the old hat--"but there are points in connection with it which are not entirely devoid of interest and even of instruction."</p><p>I seated myself in his armchair and warmed my hands before his crackling fire, for a sharp frost had set in, and the windows were thick with the ice crystals. "I suppose," I remarked, "that, homely as it looks, this thing has some deadly story linked on to it--that it is the clue which will guide you in the solution of some mystery and the punishment of some crime."</p><h2>The Mystery Unfolds</h2><p>"No, no. No crime," said Sherlock Holmes, laughing. "Only one of those whimsical little incidents which will happen when you have four million human beings all jostling each other within the space of a few square miles. Amid the action and reaction of so dense a swarm of humanity, every possible combination of events may be expected to take place, and many a little problem will be presented which may be striking and bizarre without being criminal."</p>',
    'en',
    'B1',
    'story',
    250,
    5
) ON CONFLICT DO NOTHING;
