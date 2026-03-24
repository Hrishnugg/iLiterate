-- Dedicated karaoke product tables

CREATE TABLE karaoke_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'fetching_lyrics',
    primary_provider TEXT NOT NULL,
    primary_track_id TEXT NOT NULL,
    primary_track_url TEXT NOT NULL,
    artwork_url TEXT,
    duration_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT karaoke_items_status_check
        CHECK (status IN ('fetching_lyrics', 'needs_lyrics', 'needs_timing', 'ready', 'error')),
    CONSTRAINT karaoke_items_provider_check
        CHECK (primary_provider IN ('spotify', 'apple_music', 'soundcloud'))
);

CREATE TABLE karaoke_item_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    karaoke_item_id UUID NOT NULL REFERENCES karaoke_items(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_track_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    artwork_url TEXT,
    duration_ms INTEGER,
    karaoke_capable BOOLEAN NOT NULL DEFAULT FALSE,
    playback_mode TEXT NOT NULL DEFAULT 'link_out',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, karaoke_item_id, provider),
    CONSTRAINT karaoke_item_tracks_provider_check
        CHECK (provider IN ('spotify', 'apple_music', 'soundcloud')),
    CONSTRAINT karaoke_item_tracks_playback_mode_check
        CHECK (playback_mode IN ('embedded', 'link_out'))
);

CREATE TABLE karaoke_lyrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    karaoke_item_id UUID NOT NULL UNIQUE REFERENCES karaoke_items(id) ON DELETE CASCADE,
    source TEXT,
    text TEXT NOT NULL DEFAULT '',
    lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT karaoke_lyrics_lines_array_check
        CHECK (jsonb_typeof(lines) = 'array')
);

CREATE TABLE karaoke_item_timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    karaoke_item_id UUID NOT NULL REFERENCES karaoke_items(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    cues JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, karaoke_item_id, provider),
    CONSTRAINT karaoke_item_timelines_provider_check
        CHECK (provider IN ('spotify', 'apple_music', 'soundcloud')),
    CONSTRAINT karaoke_item_timelines_cues_array_check
        CHECK (jsonb_typeof(cues) = 'array')
);

CREATE TABLE karaoke_lyrics_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    karaoke_item_id UUID NOT NULL UNIQUE REFERENCES karaoke_items(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT karaoke_lyrics_jobs_provider_check
        CHECK (provider IN ('spotify', 'apple_music', 'soundcloud')),
    CONSTRAINT karaoke_lyrics_jobs_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_karaoke_items_user_created
    ON karaoke_items (user_id, created_at DESC);

CREATE INDEX idx_karaoke_item_tracks_user_item
    ON karaoke_item_tracks (user_id, karaoke_item_id, provider);

CREATE INDEX idx_karaoke_item_timelines_user_item
    ON karaoke_item_timelines (user_id, karaoke_item_id, provider);

CREATE INDEX idx_karaoke_lyrics_jobs_status
    ON karaoke_lyrics_jobs (status, updated_at, created_at);

ALTER TABLE karaoke_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE karaoke_item_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE karaoke_lyrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE karaoke_item_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE karaoke_lyrics_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own karaoke items" ON karaoke_items
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own karaoke items" ON karaoke_items
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own karaoke items" ON karaoke_items
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own karaoke items" ON karaoke_items
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own karaoke item tracks" ON karaoke_item_tracks
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own karaoke item tracks" ON karaoke_item_tracks
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own karaoke item tracks" ON karaoke_item_tracks
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own karaoke item tracks" ON karaoke_item_tracks
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own karaoke lyrics" ON karaoke_lyrics
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own karaoke lyrics" ON karaoke_lyrics
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own karaoke lyrics" ON karaoke_lyrics
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own karaoke lyrics" ON karaoke_lyrics
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own karaoke timelines" ON karaoke_item_timelines
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own karaoke timelines" ON karaoke_item_timelines
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own karaoke timelines" ON karaoke_item_timelines
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own karaoke timelines" ON karaoke_item_timelines
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own karaoke lyric jobs" ON karaoke_lyrics_jobs
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own karaoke lyric jobs" ON karaoke_lyrics_jobs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own karaoke lyric jobs" ON karaoke_lyrics_jobs
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own karaoke lyric jobs" ON karaoke_lyrics_jobs
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_karaoke_items_updated_at ON karaoke_items;
CREATE TRIGGER update_karaoke_items_updated_at
    BEFORE UPDATE ON karaoke_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_karaoke_item_tracks_updated_at ON karaoke_item_tracks;
CREATE TRIGGER update_karaoke_item_tracks_updated_at
    BEFORE UPDATE ON karaoke_item_tracks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_karaoke_lyrics_updated_at ON karaoke_lyrics;
CREATE TRIGGER update_karaoke_lyrics_updated_at
    BEFORE UPDATE ON karaoke_lyrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_karaoke_item_timelines_updated_at ON karaoke_item_timelines;
CREATE TRIGGER update_karaoke_item_timelines_updated_at
    BEFORE UPDATE ON karaoke_item_timelines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_karaoke_lyrics_jobs_updated_at ON karaoke_lyrics_jobs;
CREATE TRIGGER update_karaoke_lyrics_jobs_updated_at
    BEFORE UPDATE ON karaoke_lyrics_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
