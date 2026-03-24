-- Karaoke provider connections, linked tracks, and timed lyric cues

CREATE TABLE user_music_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_type TEXT,
    expires_at TIMESTAMPTZ,
    external_user_id TEXT,
    scopes TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider),
    CONSTRAINT user_music_connections_provider_check
        CHECK (provider IN ('spotify', 'apple_music', 'soundcloud'))
);

CREATE TABLE content_provider_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
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
    UNIQUE (user_id, content_id, provider),
    CONSTRAINT content_provider_tracks_provider_check
        CHECK (provider IN ('spotify', 'apple_music', 'soundcloud')),
    CONSTRAINT content_provider_tracks_playback_mode_check
        CHECK (playback_mode IN ('embedded', 'link_out'))
);

CREATE TABLE karaoke_timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    cues JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, content_id, provider),
    CONSTRAINT karaoke_timelines_provider_check
        CHECK (provider IN ('tts', 'spotify', 'apple_music', 'soundcloud')),
    CONSTRAINT karaoke_timelines_cues_array_check
        CHECK (jsonb_typeof(cues) = 'array')
);

CREATE INDEX idx_user_music_connections_user_provider
    ON user_music_connections (user_id, provider);

CREATE INDEX idx_content_provider_tracks_user_content
    ON content_provider_tracks (user_id, content_id, provider);

CREATE INDEX idx_karaoke_timelines_user_content
    ON karaoke_timelines (user_id, content_id, provider);

ALTER TABLE user_music_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_provider_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE karaoke_timelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own music connections" ON user_music_connections
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own music connections" ON user_music_connections
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own music connections" ON user_music_connections
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own music connections" ON user_music_connections
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own provider tracks" ON content_provider_tracks
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own provider tracks" ON content_provider_tracks
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own provider tracks" ON content_provider_tracks
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own provider tracks" ON content_provider_tracks
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own karaoke timelines" ON karaoke_timelines
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own karaoke timelines" ON karaoke_timelines
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own karaoke timelines" ON karaoke_timelines
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own karaoke timelines" ON karaoke_timelines
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_music_connections_updated_at ON user_music_connections;
CREATE TRIGGER update_user_music_connections_updated_at
    BEFORE UPDATE ON user_music_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_content_provider_tracks_updated_at ON content_provider_tracks;
CREATE TRIGGER update_content_provider_tracks_updated_at
    BEFORE UPDATE ON content_provider_tracks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_karaoke_timelines_updated_at ON karaoke_timelines;
CREATE TRIGGER update_karaoke_timelines_updated_at
    BEFORE UPDATE ON karaoke_timelines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
