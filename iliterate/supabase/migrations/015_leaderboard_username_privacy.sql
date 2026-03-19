-- ============================================================================
-- 015: Show username on leaderboard + privacy toggle
-- ============================================================================

-- 1. Add anonymity flag to public_profiles
ALTER TABLE public_profiles
  ADD COLUMN IF NOT EXISTS leaderboard_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Recreate get_leaderboard to use username, respect anonymity
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
    CASE
      WHEN pp.leaderboard_anonymous THEN 'Anonymous'
      ELSE COALESCE(NULLIF(pp.username, ''), pp.display_name, p.display_name, 'Anonymous')
    END AS display_name,
    SUM(pe.points)::BIGINT AS total_points
  FROM point_events pe
  JOIN profiles p ON p.id = pe.user_id
  LEFT JOIN public_profiles pp ON pp.id = pe.user_id
  WHERE pe.created_at >= period_start
  GROUP BY pe.user_id, pp.leaderboard_anonymous, pp.username, pp.display_name, p.display_name
  ORDER BY total_points DESC
  LIMIT lim
  OFFSET off;
$$;

-- 3. Recreate get_friends_leaderboard to use username, respect anonymity
CREATE OR REPLACE FUNCTION get_friends_leaderboard(
  target_user_id UUID,
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
  WITH friend_ids AS (
    SELECT target_user_id AS uid
    UNION
    SELECT CASE WHEN f.user_one_id = target_user_id THEN f.user_two_id ELSE f.user_one_id END
    FROM friendships f
    WHERE f.status = 'accepted'
      AND (f.user_one_id = target_user_id OR f.user_two_id = target_user_id)
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY SUM(pe.points) DESC) AS rank,
    pe.user_id,
    CASE
      WHEN pp.leaderboard_anonymous THEN 'Anonymous'
      ELSE COALESCE(NULLIF(pp.username, ''), pp.display_name, p.display_name, 'Anonymous')
    END AS display_name,
    SUM(pe.points)::BIGINT AS total_points
  FROM point_events pe
  JOIN profiles p ON p.id = pe.user_id
  LEFT JOIN public_profiles pp ON pp.id = pe.user_id
  JOIN friend_ids fi ON fi.uid = pe.user_id
  WHERE pe.created_at >= period_start
  GROUP BY pe.user_id, pp.leaderboard_anonymous, pp.username, pp.display_name, p.display_name
  ORDER BY total_points DESC
  LIMIT lim
  OFFSET off;
$$;
