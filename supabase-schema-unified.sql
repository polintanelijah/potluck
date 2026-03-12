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
  status TEXT NOT NULL CHECK (status IN ('cooked')),
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

-- User Recipe Rankings (authoritative per-user ranking state)
CREATE TABLE IF NOT EXISTS user_recipe_rankings (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL CHECK (bucket IN ('loved', 'fine', 'didnt_like')),
  rank_position INTEGER NOT NULL CHECK (rank_position > 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, recipe_id),
  UNIQUE (user_id, bucket, rank_position)
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
CREATE INDEX IF NOT EXISTS idx_user_recipe_rankings_bucket_position ON user_recipe_rankings(user_id, bucket, rank_position);

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

-- User Recipe Rankings
ALTER TABLE user_recipe_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User recipe rankings viewable by everyone" ON user_recipe_rankings FOR SELECT USING (true);
CREATE POLICY "Users can insert own rankings" ON user_recipe_rankings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rankings" ON user_recipe_rankings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rankings" ON user_recipe_rankings FOR DELETE USING (auth.uid() = user_id);

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

-- Keep denormalized engagement counts on posts in sync
CREATE OR REPLACE FUNCTION public.update_post_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_post_id UUID;
  v_column_name TEXT;
  v_delta INTEGER;
BEGIN
  v_post_id := COALESCE(NEW.post_id, OLD.post_id);
  v_delta := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;

  IF TG_TABLE_NAME = 'likes' THEN
    v_column_name := 'like_count';
  ELSIF TG_TABLE_NAME = 'comments' THEN
    v_column_name := 'comment_count';
  ELSIF TG_TABLE_NAME = 'want_to_cook_actions' THEN
    v_column_name := 'want_to_cook_count';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  EXECUTE format(
    'UPDATE posts SET %I = GREATEST(COALESCE(%I, 0) + $1, 0) WHERE id = $2',
    v_column_name,
    v_column_name
  )
  USING v_delta, v_post_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep cooked counters and recipe totals in sync
CREATE OR REPLACE FUNCTION public.handle_cooked_recipe_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> 'cooked' THEN
    RETURN NEW;
  END IF;

  IF NEW.post_id IS NOT NULL THEN
    UPDATE posts
    SET cooked_count = COALESCE(cooked_count, 0) + 1
    WHERE id = NEW.post_id;

    INSERT INTO comments (user_id, post_id, content, type)
    VALUES (NEW.user_id, NEW.post_id, 'Cooked this.', 'cooked_it');
  END IF;

  UPDATE recipes
  SET total_cooks = COALESCE(total_cooks, 0) + 1
  WHERE id = NEW.recipe_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_cooked_recipe_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'cooked' THEN
    RETURN OLD;
  END IF;

  IF OLD.post_id IS NOT NULL THEN
    UPDATE posts
    SET cooked_count = GREATEST(COALESCE(cooked_count, 0) - 1, 0)
    WHERE id = OLD.post_id;

    DELETE FROM comments
    WHERE post_id = OLD.post_id
      AND user_id = OLD.user_id
      AND type = 'cooked_it';
  END IF;

  UPDATE recipes
  SET total_cooks = GREATEST(COALESCE(total_cooks, 0) - 1, 0)
  WHERE id = OLD.recipe_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
CREATE TRIGGER set_updated_at_user_recipe_rankings BEFORE UPDATE ON user_recipe_rankings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS update_post_like_count ON likes;
CREATE TRIGGER update_post_like_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_counts();

DROP TRIGGER IF EXISTS update_post_comment_count ON comments;
CREATE TRIGGER update_post_comment_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_counts();

DROP TRIGGER IF EXISTS update_post_want_to_cook_count ON want_to_cook_actions;
CREATE TRIGGER update_post_want_to_cook_count
  AFTER INSERT OR DELETE ON want_to_cook_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_post_counts();

DROP TRIGGER IF EXISTS update_cooked_side_effects_insert ON user_recipes;
CREATE TRIGGER update_cooked_side_effects_insert
  AFTER INSERT ON user_recipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_cooked_recipe_insert();

DROP TRIGGER IF EXISTS update_cooked_side_effects_delete ON user_recipes;
CREATE TRIGGER update_cooked_side_effects_delete
  AFTER DELETE ON user_recipes
  FOR EACH ROW EXECUTE FUNCTION public.handle_cooked_recipe_delete();

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
