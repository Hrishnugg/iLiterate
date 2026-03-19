-- 1a. Unique constraint on streaks.user_id (needed for upsert)
ALTER TABLE streaks ADD CONSTRAINT streaks_user_id_unique UNIQUE (user_id);

-- 1b. refresh_user_streak: atomically update streak on activity
CREATE OR REPLACE FUNCTION refresh_user_streak(target_user_id UUID)
RETURNS TABLE (
  current_streak  INTEGER,
  longest_streak  INTEGER,
  last_activity_date DATE,
  streak_start_date  DATE,
  is_new_day      BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak  INTEGER;
  v_longest_streak  INTEGER;
  v_last_activity   DATE;
  v_streak_start    DATE;
  v_is_new_day      BOOLEAN;
BEGIN
  -- Try to lock the existing row
  SELECT s.current_streak, s.longest_streak, s.last_activity_date, s.streak_start_date
    INTO v_current_streak, v_longest_streak, v_last_activity, v_streak_start
    FROM streaks s
   WHERE s.user_id = target_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    -- No row yet — insert a fresh streak
    INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date, streak_start_date)
    VALUES (target_user_id, 1, 1, CURRENT_DATE, CURRENT_DATE);

    RETURN QUERY SELECT 1, 1, CURRENT_DATE, CURRENT_DATE, TRUE;
    RETURN;
  END IF;

  IF v_last_activity = CURRENT_DATE THEN
    -- Already active today — no-op
    v_is_new_day := FALSE;

  ELSIF v_last_activity = CURRENT_DATE - 1 THEN
    -- Consecutive day — increment
    v_current_streak := v_current_streak + 1;
    v_is_new_day := TRUE;

    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;

    UPDATE streaks
       SET current_streak    = v_current_streak,
           longest_streak    = v_longest_streak,
           last_activity_date = CURRENT_DATE
     WHERE streaks.user_id = target_user_id;

  ELSE
    -- Streak broken — reset
    v_current_streak := 1;
    v_streak_start   := CURRENT_DATE;
    v_is_new_day     := TRUE;

    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;

    UPDATE streaks
       SET current_streak     = 1,
           longest_streak     = v_longest_streak,
           last_activity_date = CURRENT_DATE,
           streak_start_date  = CURRENT_DATE
     WHERE streaks.user_id = target_user_id;
  END IF;

  RETURN QUERY SELECT v_current_streak, v_longest_streak, CURRENT_DATE, v_streak_start, v_is_new_day;
END;
$$;

-- 1c. get_user_streak: simple read helper
CREATE OR REPLACE FUNCTION get_user_streak(target_user_id UUID)
RETURNS TABLE (
  current_streak     INTEGER,
  longest_streak     INTEGER,
  last_activity_date DATE,
  streak_start_date  DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT s.current_streak, s.longest_streak, s.last_activity_date, s.streak_start_date
      FROM streaks s
     WHERE s.user_id = target_user_id;
END;
$$;
