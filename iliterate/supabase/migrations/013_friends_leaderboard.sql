-- Migration: 013_friends_leaderboard.sql
-- Description: Add friends-scoped leaderboard functions

-- ============================================================================
-- 1. Friends Leaderboard (ranked list)
-- ============================================================================

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
    COALESCE(p.display_name, 'Anonymous') AS display_name,
    SUM(pe.points)::BIGINT AS total_points
  FROM point_events pe
  JOIN profiles p ON p.id = pe.user_id
  JOIN friend_ids fi ON fi.uid = pe.user_id
  WHERE pe.created_at >= period_start
  GROUP BY pe.user_id, p.display_name
  ORDER BY total_points DESC
  LIMIT lim
  OFFSET off;
$$;

-- ============================================================================
-- 2. Friends Leaderboard User Rank
-- ============================================================================

CREATE OR REPLACE FUNCTION get_friends_leaderboard_user_rank(
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
  WITH friend_ids AS (
    SELECT target_user_id AS uid
    UNION
    SELECT CASE WHEN f.user_one_id = target_user_id THEN f.user_two_id ELSE f.user_one_id END
    FROM friendships f
    WHERE f.status = 'accepted'
      AND (f.user_one_id = target_user_id OR f.user_two_id = target_user_id)
  ),
  user_totals AS (
    SELECT
      pe.user_id,
      SUM(pe.points)::BIGINT AS total_points
    FROM point_events pe
    JOIN friend_ids fi ON fi.uid = pe.user_id
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

-- ============================================================================
-- 3. Friends Leaderboard Participant Count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_friends_leaderboard_participant_count(
  target_user_id UUID,
  period_start TIMESTAMPTZ
)
RETURNS BIGINT
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
  SELECT COUNT(DISTINCT pe.user_id)::BIGINT
  FROM point_events pe
  JOIN friend_ids fi ON fi.uid = pe.user_id
  WHERE pe.created_at >= period_start;
$$;
