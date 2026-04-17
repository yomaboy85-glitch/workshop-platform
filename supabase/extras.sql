-- ============================================================
-- WORKSHOP PLATFORM - ADDITIONAL SETUP
-- Run AFTER schema.sql if you need these extras
-- ============================================================

-- ============================================================
-- FIX: Allow users to insert their own score via client
-- (needed for quiz/mission/voting where client writes directly)
-- ============================================================
DROP POLICY IF EXISTS "scores_insert" ON scores;
CREATE POLICY "scores_insert" ON scores
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT auth_id FROM users WHERE id = user_id)
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- FIX: Allow team_members to be read by everyone
-- Allow users to insert their own membership (for self-join)
-- ============================================================
DROP POLICY IF EXISTS "team_members_all" ON team_members;
CREATE POLICY "team_members_admin" ON team_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- FIX: Allow quiz_answers, mission_completions, votes to be
-- inserted by the authenticated user themselves
-- ============================================================
DROP POLICY IF EXISTS "quiz_answers_insert" ON quiz_answers;
CREATE POLICY "quiz_answers_insert" ON quiz_answers
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT auth_id FROM users WHERE id = user_id)
  );

DROP POLICY IF EXISTS "missions_insert" ON mission_completions;
CREATE POLICY "missions_insert" ON mission_completions
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT auth_id FROM users WHERE id = user_id)
  );

DROP POLICY IF EXISTS "votes_insert" ON votes;
CREATE POLICY "votes_insert" ON votes
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT auth_id FROM users WHERE id = user_id)
  );

-- ============================================================
-- FUNCTION: get_leaderboard (alternative to VIEW for RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION get_leaderboard(p_limit INT DEFAULT 50)
RETURNS TABLE(
  id UUID,
  name TEXT,
  team_name TEXT,
  team_color TEXT,
  total_score BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    COALESCE(t.name, '무소속')::TEXT AS team_name,
    COALESCE(t.color, '#94a3b8')::TEXT AS team_color,
    COALESCE(SUM(s.points), 0) AS total_score
  FROM users u
  LEFT JOIN team_members tm ON tm.user_id = u.id
  LEFT JOIN teams t ON t.id = tm.team_id
  LEFT JOIN scores s ON s.user_id = u.id
  WHERE u.role = 'user'
  GROUP BY u.id, u.name, t.name, t.color
  ORDER BY total_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- INDEX: Speed up common queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_game_id ON scores(game_id);
CREATE INDEX IF NOT EXISTS idx_scores_team_id ON scores(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_treasures_game_id ON treasures(game_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_composite ON quiz_answers(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mission_completions_composite ON mission_completions(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_votes_composite ON votes(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

-- ============================================================
-- HEARTBEAT: Keep users online status accurate
-- Call this from the client periodically
-- ============================================================
CREATE OR REPLACE FUNCTION update_presence(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users SET is_online = true, last_seen = NOW() WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CLEANUP: Mark users offline if last_seen > 2 minutes
-- Run as a cron job via pg_cron (Supabase supports this)
-- In Supabase: Database > Extensions > enable pg_cron
-- Then: SELECT cron.schedule('mark-offline', '* * * * *', $$
--   UPDATE users SET is_online = false
--   WHERE last_seen < NOW() - INTERVAL '2 minutes' AND is_online = true;
-- $$);
-- ============================================================
