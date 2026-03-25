-- Integrated karaoke workspace refresh: setlists, split statuses, and idempotent imports

ALTER TABLE karaoke_items
  ADD COLUMN IF NOT EXISTS lyrics_status TEXT NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS timing_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS provider_sync_capable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_match_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS last_match_source TEXT,
  ADD COLUMN IF NOT EXISTS last_match_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE karaoke_items
  DROP CONSTRAINT IF EXISTS karaoke_items_lyrics_status_check,
  ADD CONSTRAINT karaoke_items_lyrics_status_check
    CHECK (lyrics_status IN ('queued', 'matching', 'ready', 'needs_review', 'manual_fallback', 'error')),
  DROP CONSTRAINT IF EXISTS karaoke_items_timing_status_check,
  ADD CONSTRAINT karaoke_items_timing_status_check
    CHECK (timing_status IN ('not_applicable', 'draft', 'ready', 'needs_review'));

UPDATE karaoke_items AS item
SET
  provider_sync_capable = CASE
    WHEN item.primary_provider IN ('soundcloud', 'apple_music') THEN TRUE
    ELSE FALSE
  END,
  lyrics_status = CASE
    WHEN item.status = 'error' THEN 'error'
    WHEN item.status = 'needs_lyrics' THEN 'manual_fallback'
    WHEN item.status = 'fetching_lyrics' THEN 'matching'
    WHEN EXISTS (
      SELECT 1
      FROM karaoke_lyrics lyrics
      WHERE lyrics.karaoke_item_id = item.id
        AND jsonb_array_length(COALESCE(lyrics.lines::jsonb, '[]'::jsonb)) > 0
    ) THEN 'ready'
    ELSE 'manual_fallback'
  END,
  timing_status = CASE
    WHEN item.primary_provider = 'spotify' THEN 'not_applicable'
    WHEN item.status = 'ready' THEN 'ready'
    WHEN EXISTS (
      SELECT 1
      FROM karaoke_item_timelines timeline
      WHERE timeline.karaoke_item_id = item.id
        AND timeline.provider = item.primary_provider
        AND jsonb_array_length(COALESCE(timeline.cues::jsonb, '[]'::jsonb)) > 0
    ) THEN 'ready'
    ELSE 'draft'
  END,
  last_match_source = COALESCE(item.last_match_source, 'migration'),
  last_match_metadata = COALESCE(item.last_match_metadata, '{}'::jsonb);

CREATE TABLE IF NOT EXISTS karaoke_setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS karaoke_setlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  setlist_id UUID NOT NULL REFERENCES karaoke_setlists(id) ON DELETE CASCADE,
  karaoke_item_id UUID NOT NULL REFERENCES karaoke_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (setlist_id, karaoke_item_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_karaoke_setlists_default
  ON karaoke_setlists (user_id)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_karaoke_setlists_user_created
  ON karaoke_setlists (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_karaoke_setlist_items_user_setlist
  ON karaoke_setlist_items (user_id, setlist_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_karaoke_item_tracks_user_provider_track
  ON karaoke_item_tracks (user_id, provider, provider_track_id);

ALTER TABLE karaoke_setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE karaoke_setlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own karaoke setlists" ON karaoke_setlists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own karaoke setlists" ON karaoke_setlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own karaoke setlists" ON karaoke_setlists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own karaoke setlists" ON karaoke_setlists
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own karaoke setlist items" ON karaoke_setlist_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own karaoke setlist items" ON karaoke_setlist_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own karaoke setlist items" ON karaoke_setlist_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own karaoke setlist items" ON karaoke_setlist_items
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_karaoke_setlists_updated_at ON karaoke_setlists;
CREATE TRIGGER update_karaoke_setlists_updated_at
  BEFORE UPDATE ON karaoke_setlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_karaoke_setlist_items_updated_at ON karaoke_setlist_items;
CREATE TRIGGER update_karaoke_setlist_items_updated_at
  BEFORE UPDATE ON karaoke_setlist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO karaoke_setlists (user_id, name, is_default, metadata)
SELECT DISTINCT item.user_id, 'Main Setlist', TRUE, '{}'::jsonb
FROM karaoke_items item
WHERE NOT EXISTS (
  SELECT 1
  FROM karaoke_setlists setlist
  WHERE setlist.user_id = item.user_id
    AND setlist.is_default = TRUE
);

INSERT INTO karaoke_setlist_items (user_id, setlist_id, karaoke_item_id, sort_order, metadata)
SELECT
  item.user_id,
  setlist.id,
  item.id,
  ROW_NUMBER() OVER (PARTITION BY item.user_id ORDER BY item.created_at ASC) - 1,
  jsonb_build_object('seededByMigration', TRUE)
FROM karaoke_items item
JOIN karaoke_setlists setlist
  ON setlist.user_id = item.user_id
  AND setlist.is_default = TRUE
ON CONFLICT (setlist_id, karaoke_item_id) DO NOTHING;
