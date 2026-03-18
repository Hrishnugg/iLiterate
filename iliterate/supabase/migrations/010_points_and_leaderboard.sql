-- ============================================================================
-- Points System & Leaderboard
-- ============================================================================

-- Add display_name to profiles for leaderboard display
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Point events: immutable log of every point-earning action
CREATE TABLE IF NOT EXISTS point_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  source TEXT NOT NULL CHECK (source IN (
    'quiz_completion',
    'reading_completion',
    'lesson_completion',
    'flashcard_review',
    'streak_bonus',
    'perfect_quiz'
  )),
  source_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for leaderboard aggregation queries
CREATE INDEX IF NOT EXISTS idx_point_events_user_created
  ON point_events (user_id, created_at DESC);

-- Index for anti-gaming duplicate checks (flashcard per-card per-day)
CREATE INDEX IF NOT EXISTS idx_point_events_source_dedup
  ON point_events (user_id, source, source_id, created_at);

-- RLS policies
ALTER TABLE point_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own point events"
  ON point_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own point events"
  ON point_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Leaderboard function (SECURITY DEFINER to bypass RLS on profiles)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_leaderboard(
  period_start TIMESTAMPTZ,
  lim INT DEFAULT 20,
  off INT DEFAULT 0
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  display_name TEXT,
  total_points BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY SUM(pe.points) DESC) AS rank,
    pe.user_id,
    COALESCE(p.display_name, 'Anonymous') AS display_name,
    SUM(pe.points)::BIGINT AS total_points
  FROM point_events pe
  JOIN profiles p ON p.id = pe.user_id
  WHERE pe.created_at >= period_start
  GROUP BY pe.user_id, p.display_name
  ORDER BY total_points DESC
  LIMIT lim
  OFFSET off;
$$;

-- Function to get a single user's rank and points for a period
CREATE OR REPLACE FUNCTION get_user_rank(
  target_user_id UUID,
  period_start TIMESTAMPTZ
)
RETURNS TABLE (
  rank BIGINT,
  total_points BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH user_totals AS (
    SELECT
      pe.user_id,
      SUM(pe.points)::BIGINT AS total_points
    FROM point_events pe
    WHERE pe.created_at >= period_start
    GROUP BY pe.user_id
  ),
  ranked AS (
    SELECT
      ut.user_id,
      ROW_NUMBER() OVER (ORDER BY ut.total_points DESC) AS rank,
      ut.total_points
    FROM user_totals ut
  )
  SELECT r.rank, r.total_points
  FROM ranked r
  WHERE r.user_id = target_user_id;
$$;

-- Function to get total participants in a period
CREATE OR REPLACE FUNCTION get_leaderboard_participant_count(
  period_start TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(DISTINCT user_id)::BIGINT
  FROM point_events
  WHERE created_at >= period_start;
$$;
