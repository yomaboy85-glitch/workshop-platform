-- ============================================================
-- WORKSHOP PLATFORM - SUPABASE SQL SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TEAMS TABLE
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  total_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TEAM MEMBERS TABLE
-- ============================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- GAMES TABLE
-- ============================================================
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('quiz', 'mission', 'timer', 'voting', 'treasure')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'ended')),
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TREASURES TABLE
-- ============================================================
CREATE TABLE treasures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  hint TEXT,
  score INTEGER DEFAULT 100,
  reveal_radius INTEGER DEFAULT 100,
  claim_radius INTEGER DEFAULT 30,
  is_found BOOLEAN DEFAULT false,
  found_by UUID REFERENCES users(id),
  found_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCORES TABLE
-- ============================================================
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REWARDS TABLE
-- ============================================================
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rank INTEGER NOT NULL UNIQUE,
  reward_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANNOUNCEMENTS TABLE
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'banner' CHECK (type IN ('banner', 'modal')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUIZ ANSWERS TABLE (for tracking quiz submissions)
-- ============================================================
CREATE TABLE quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  answer TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, user_id, question_index)
);

-- ============================================================
-- MISSION COMPLETIONS TABLE
-- ============================================================
CREATE TABLE mission_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mission_index INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, user_id, mission_index)
);

-- ============================================================
-- VOTES TABLE
-- ============================================================
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

-- ============================================================
-- VIEWS: Leaderboard
-- ============================================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.name,
  u.role,
  COALESCE(t.name, '무소속') AS team_name,
  t.color AS team_color,
  COALESCE(SUM(s.points), 0) AS total_score
FROM users u
LEFT JOIN team_members tm ON tm.user_id = u.id
LEFT JOIN teams t ON t.id = tm.team_id
LEFT JOIN scores s ON s.user_id = u.id
WHERE u.role = 'user'
GROUP BY u.id, u.name, u.role, t.name, t.color
ORDER BY total_score DESC;

-- ============================================================
-- VIEWS: Team Leaderboard
-- ============================================================
CREATE OR REPLACE VIEW team_leaderboard AS
SELECT
  t.id,
  t.name,
  t.color,
  COUNT(DISTINCT tm.user_id) AS member_count,
  COALESCE(SUM(s.points), 0) AS total_score
FROM teams t
LEFT JOIN team_members tm ON tm.team_id = t.id
LEFT JOIN scores s ON s.team_id = t.id
GROUP BY t.id, t.name, t.color
ORDER BY total_score DESC;

-- ============================================================
-- FUNCTION: Claim treasure (atomic, prevents duplicates)
-- ============================================================
CREATE OR REPLACE FUNCTION claim_treasure(
  p_treasure_id UUID,
  p_user_id UUID,
  p_team_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_treasure treasures%ROWTYPE;
  v_score_id UUID;
BEGIN
  -- Lock the row
  SELECT * INTO v_treasure FROM treasures
  WHERE id = p_treasure_id FOR UPDATE;

  -- Already found
  IF v_treasure.is_found THEN
    RETURN jsonb_build_object('success', false, 'message', '이미 다른 사람이 찾은 보물입니다.');
  END IF;

  -- Mark as found
  UPDATE treasures SET
    is_found = true,
    found_by = p_user_id,
    found_at = NOW()
  WHERE id = p_treasure_id;

  -- Add score
  INSERT INTO scores (user_id, team_id, game_id, points, reason)
  VALUES (p_user_id, p_team_id, v_treasure.game_id, v_treasure.score, '보물 발견')
  RETURNING id INTO v_score_id;

  -- Update team total
  IF p_team_id IS NOT NULL THEN
    UPDATE teams SET total_score = total_score + v_treasure.score
    WHERE id = p_team_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'score', v_treasure.score, 'score_id', v_score_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Add score with team update
-- ============================================================
CREATE OR REPLACE FUNCTION add_score(
  p_user_id UUID,
  p_game_id UUID,
  p_points INTEGER,
  p_reason TEXT DEFAULT '점수 추가'
) RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
  v_score_id UUID;
BEGIN
  SELECT team_id INTO v_team_id FROM team_members WHERE user_id = p_user_id;

  INSERT INTO scores (user_id, team_id, game_id, points, reason)
  VALUES (p_user_id, v_team_id, p_game_id, p_points, p_reason)
  RETURNING id INTO v_score_id;

  IF v_team_id IS NOT NULL THEN
    UPDATE teams SET total_score = total_score + p_points WHERE id = v_team_id;
  END IF;

  RETURN v_score_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasures ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read, only owner or admin can update
CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (auth.uid() = auth_id);
CREATE POLICY "users_update" ON users FOR UPDATE USING (auth.uid() = auth_id OR
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Teams: anyone can read
CREATE POLICY "teams_select" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_all" ON teams FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Team members: anyone can read
CREATE POLICY "team_members_select" ON team_members FOR SELECT USING (true);
CREATE POLICY "team_members_all" ON team_members FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin') OR
  auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Games: anyone can read
CREATE POLICY "games_select" ON games FOR SELECT USING (true);
CREATE POLICY "games_all" ON games FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Treasures: anyone can read, admin can write
CREATE POLICY "treasures_select" ON treasures FOR SELECT USING (true);
CREATE POLICY "treasures_all" ON treasures FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Scores: anyone can read, admin can write
CREATE POLICY "scores_select" ON scores FOR SELECT USING (true);
CREATE POLICY "scores_insert" ON scores FOR INSERT WITH CHECK (true);
CREATE POLICY "scores_admin" ON scores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Rewards: anyone can read
CREATE POLICY "rewards_select" ON rewards FOR SELECT USING (true);
CREATE POLICY "rewards_all" ON rewards FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Announcements: anyone can read
CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (true);
CREATE POLICY "announcements_all" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

-- Quiz answers / missions / votes
CREATE POLICY "quiz_answers_select" ON quiz_answers FOR SELECT USING (true);
CREATE POLICY "quiz_answers_insert" ON quiz_answers FOR INSERT WITH CHECK (true);

CREATE POLICY "missions_select" ON mission_completions FOR SELECT USING (true);
CREATE POLICY "missions_insert" ON mission_completions FOR INSERT WITH CHECK (true);

CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT WITH CHECK (true);

-- ============================================================
-- REALTIME: Enable for key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE treasures;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;

-- ============================================================
-- SEED: Default rewards
-- ============================================================
INSERT INTO rewards (rank, reward_name, description) VALUES
  (1, '🥇 1등 상품', '최고의 워크샵 챔피언!'),
  (2, '🥈 2등 상품', '훌륭한 성과!'),
  (3, '🥉 3등 상품', '멋진 도전!');

-- ============================================================
-- SEED: Admin user (run after signing up via app)
-- UPDATE users SET role = 'admin' WHERE auth_id = 'YOUR_AUTH_UUID';
-- ============================================================
