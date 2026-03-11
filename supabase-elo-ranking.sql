-- =============================================
-- Potluck — Elo Ranking System Migration
-- Run this in the Supabase SQL Editor
-- =============================================

-- 1. Pairwise votes table
CREATE TABLE IF NOT EXISTS pairwise_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_a_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_b_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_recipes CHECK (recipe_a_id <> recipe_b_id),
  CONSTRAINT winner_is_participant CHECK (winner_id IN (recipe_a_id, recipe_b_id))
);

CREATE INDEX IF NOT EXISTS idx_pairwise_votes_user ON pairwise_votes(user_id);

-- 2. Per-user Elo ratings table
CREATE TABLE IF NOT EXISTS recipe_elo_ratings (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  elo_score NUMERIC(8,2) NOT NULL DEFAULT 1500.00,
  total_comparisons INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_elo_user_score ON recipe_elo_ratings(user_id, elo_score DESC);

-- 3. RLS policies
ALTER TABLE pairwise_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pairwise votes are viewable by everyone" ON pairwise_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert own votes" ON pairwise_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE recipe_elo_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Elo ratings are viewable by everyone" ON recipe_elo_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert own elo" ON recipe_elo_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own elo" ON recipe_elo_ratings FOR UPDATE USING (auth.uid() = user_id);

-- 4. Elo calculation function (K=32)
CREATE OR REPLACE FUNCTION public.calculate_elo()
RETURNS TRIGGER AS $$
DECLARE
  v_elo_a NUMERIC(8,2);
  v_elo_b NUMERIC(8,2);
  v_expected_a NUMERIC;
  v_expected_b NUMERIC;
  v_score_a NUMERIC;
  v_score_b NUMERIC;
  v_k NUMERIC := 32;
BEGIN
  -- Upsert default Elo for recipe A if not exists
  INSERT INTO recipe_elo_ratings (user_id, recipe_id, elo_score, total_comparisons, wins, losses)
  VALUES (NEW.user_id, NEW.recipe_a_id, 1500.00, 0, 0, 0)
  ON CONFLICT (user_id, recipe_id) DO NOTHING;

  -- Upsert default Elo for recipe B if not exists
  INSERT INTO recipe_elo_ratings (user_id, recipe_id, elo_score, total_comparisons, wins, losses)
  VALUES (NEW.user_id, NEW.recipe_b_id, 1500.00, 0, 0, 0)
  ON CONFLICT (user_id, recipe_id) DO NOTHING;

  -- Get current Elo scores
  SELECT elo_score INTO v_elo_a
  FROM recipe_elo_ratings
  WHERE user_id = NEW.user_id AND recipe_id = NEW.recipe_a_id;

  SELECT elo_score INTO v_elo_b
  FROM recipe_elo_ratings
  WHERE user_id = NEW.user_id AND recipe_id = NEW.recipe_b_id;

  -- Calculate expected scores
  v_expected_a := 1.0 / (1.0 + power(10.0, (v_elo_b - v_elo_a) / 400.0));
  v_expected_b := 1.0 / (1.0 + power(10.0, (v_elo_a - v_elo_b) / 400.0));

  -- Determine actual scores (1 for win, 0 for loss)
  IF NEW.winner_id = NEW.recipe_a_id THEN
    v_score_a := 1;
    v_score_b := 0;
  ELSE
    v_score_a := 0;
    v_score_b := 1;
  END IF;

  -- Update recipe A
  UPDATE recipe_elo_ratings
  SET elo_score = elo_score + v_k * (v_score_a - v_expected_a),
      total_comparisons = total_comparisons + 1,
      wins = wins + v_score_a::INTEGER,
      losses = losses + v_score_b::INTEGER,
      updated_at = NOW()
  WHERE user_id = NEW.user_id AND recipe_id = NEW.recipe_a_id;

  -- Update recipe B
  UPDATE recipe_elo_ratings
  SET elo_score = elo_score + v_k * (v_score_b - v_expected_b),
      total_comparisons = total_comparisons + 1,
      wins = wins + v_score_b::INTEGER,
      losses = losses + v_score_a::INTEGER,
      updated_at = NOW()
  WHERE user_id = NEW.user_id AND recipe_id = NEW.recipe_b_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger on pairwise_votes insert
DROP TRIGGER IF EXISTS update_elo_on_vote ON pairwise_votes;
CREATE TRIGGER update_elo_on_vote
  AFTER INSERT ON pairwise_votes
  FOR EACH ROW EXECUTE FUNCTION public.calculate_elo();
