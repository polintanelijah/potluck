-- =============================================
-- Potluck MVP — Unified Schema
-- Run this in Supabase SQL Editor on a CLEAN project
-- (or after dropping all existing tables)
-- =============================================

-- =============================================
-- 1. TABLES
-- =============================================

-- Profiles (synced from auth.users via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follows (social graph)
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Recipes (canonical food entity)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  source_site TEXT,
  extracted_data JSONB,
  ingredients JSONB,
  instructions JSONB,
  tags TEXT[],
  image_url TEXT,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  total_cooks INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts (social feed entity, replaces legacy cook_sessions)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'cook_log',
  caption TEXT,
  image_url TEXT,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  want_to_cook_count INTEGER DEFAULT 0,
  cooked_count INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Recipes (personal user↔recipe relationship)
CREATE TABLE IF NOT EXISTS user_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('want_to_cook', 'cooked')),
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  cooked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, recipe_id, status)
);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Want to Cook Actions (social bookmark on posts)
CREATE TABLE IF NOT EXISTS want_to_cook_actions (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'comment',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pairwise Votes (head-to-head recipe comparisons)
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

-- Recipe Elo Ratings (per-user personal ranking scores)
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

-- =============================================
-- 2. INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_recipe_id ON posts(recipe_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON recipes(created_by);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_user_recipes_user_status ON user_recipes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pairwise_votes_user ON pairwise_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_elo_user_score ON recipe_elo_ratings(user_id, elo_score DESC);

-- =============================================
-- 3. ROW LEVEL SECURITY
-- =============================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Follows
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipes viewable by everyone" ON recipes FOR SELECT USING (true);
CREATE POLICY "Users can create recipes" ON recipes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own recipes" ON recipes FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own recipes" ON recipes FOR DELETE USING (auth.uid() = created_by);

-- Posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- User Recipes
ALTER TABLE user_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User recipes viewable by everyone" ON user_recipes FOR SELECT USING (true);
CREATE POLICY "Users can insert own user_recipes" ON user_recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own user_recipes" ON user_recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own user_recipes" ON user_recipes FOR DELETE USING (auth.uid() = user_id);

-- Likes
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by everyone" ON likes FOR SELECT USING (true);
CREATE POLICY "Users can like" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Want to Cook Actions
ALTER TABLE want_to_cook_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Want to cook viewable by everyone" ON want_to_cook_actions FOR SELECT USING (true);
CREATE POLICY "Users can bookmark" ON want_to_cook_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unbookmark" ON want_to_cook_actions FOR DELETE USING (auth.uid() = user_id);

-- Comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Pairwise Votes
ALTER TABLE pairwise_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes viewable by everyone" ON pairwise_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert own votes" ON pairwise_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Recipe Elo Ratings
ALTER TABLE recipe_elo_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Elo ratings viewable by everyone" ON recipe_elo_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert own elo" ON recipe_elo_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own elo" ON recipe_elo_ratings FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- 4. FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', lower(split_part(NEW.email, '@', 1))),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Elo calculation (K=32)
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
  -- Upsert default Elo for both recipes
  INSERT INTO recipe_elo_ratings (user_id, recipe_id, elo_score, total_comparisons, wins, losses)
  VALUES (NEW.user_id, NEW.recipe_a_id, 1500.00, 0, 0, 0)
  ON CONFLICT (user_id, recipe_id) DO NOTHING;

  INSERT INTO recipe_elo_ratings (user_id, recipe_id, elo_score, total_comparisons, wins, losses)
  VALUES (NEW.user_id, NEW.recipe_b_id, 1500.00, 0, 0, 0)
  ON CONFLICT (user_id, recipe_id) DO NOTHING;

  -- Get current scores
  SELECT elo_score INTO v_elo_a
  FROM recipe_elo_ratings WHERE user_id = NEW.user_id AND recipe_id = NEW.recipe_a_id;

  SELECT elo_score INTO v_elo_b
  FROM recipe_elo_ratings WHERE user_id = NEW.user_id AND recipe_id = NEW.recipe_b_id;

  -- Expected scores
  v_expected_a := 1.0 / (1.0 + power(10.0, (v_elo_b - v_elo_a) / 400.0));
  v_expected_b := 1.0 / (1.0 + power(10.0, (v_elo_a - v_elo_b) / 400.0));

  -- Actual scores
  IF NEW.winner_id = NEW.recipe_a_id THEN
    v_score_a := 1; v_score_b := 0;
  ELSE
    v_score_a := 0; v_score_b := 1;
  END IF;

  -- Update both atomically
  UPDATE recipe_elo_ratings
  SET elo_score = elo_score + v_k * (v_score_a - v_expected_a),
      total_comparisons = total_comparisons + 1,
      wins = wins + v_score_a::INTEGER,
      losses = losses + v_score_b::INTEGER,
      updated_at = NOW()
  WHERE user_id = NEW.user_id AND recipe_id = NEW.recipe_a_id;

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

DROP TRIGGER IF EXISTS update_elo_on_vote ON pairwise_votes;
CREATE TRIGGER update_elo_on_vote
  AFTER INSERT ON pairwise_votes
  FOR EACH ROW EXECUTE FUNCTION public.calculate_elo();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_recipes BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_posts BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_comments BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 5. STORAGE
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view images" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own images" ON storage.objects
  FOR DELETE USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);
