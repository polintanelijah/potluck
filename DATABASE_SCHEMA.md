# Potluck — Database Schema Reference

> **Purpose:** Context document for AI agents working on the Potluck codebase. This describes the Supabase/PostgreSQL schema, what each table does, and why it's designed this way.

## Architecture Overview

Potluck is a social recipe-sharing app built on **Next.js + Supabase**. The schema separates three core concepts:

- **Recipes** — the canonical food entity (title, ingredients, instructions, URL)
- **Posts** — the social feed entity (a user sharing/reviewing/logging a cook)
- **User Recipes** — the personal relationship between a user and a recipe (want to cook, cooked, rating)

This separation keeps the feed fast (denormalized counters on posts), recipes reusable across posts, and user lists queryable without JOINs.

---

## Tables

### `profiles`
Synced from `auth.users` via trigger. All accounts are public.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | References `auth.users(id)` |
| `username` | TEXT UNIQUE NOT NULL | |
| `name` | TEXT | |
| `email` | TEXT | |
| `avatar_url` | TEXT | |
| `bio` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Reasoning:** Auto-created on signup via a `SECURITY DEFINER` trigger. Username is derived from email if not provided.

---

### `follows`
Social graph. Composite PK prevents duplicate follows.

| Column | Type | Notes |
|---|---|---|
| `follower_id` | UUID PK | References `profiles(id)` |
| `following_id` | UUID PK | References `profiles(id)` |
| `created_at` | TIMESTAMPTZ | |

**Reasoning:** Used to build the home feed (posts from followed users). Indexed on both columns for bidirectional lookups.

---

### `recipes`
The canonical recipe entity. Can be user-created or extracted from an external URL.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `url` | TEXT | Original external link |
| `source_site` | TEXT | e.g. `'allrecipes.com'`, `'potluck'` |
| `extracted_data` | JSONB | Scraped metadata (cook time, servings, nutrition) |
| `ingredients` | JSONB | Structured array of ingredient objects |
| `instructions` | JSONB | Structured array of step objects |
| `tags` | TEXT[] | Cuisine, dietary labels for filtering |
| `image_url` | TEXT | |
| `avg_rating` | NUMERIC(3,2) | Denormalized consensus rating, updated by trigger |
| `total_cooks` | INTEGER | Denormalized count, updated by trigger |
| `created_by` | UUID | References `profiles(id)`, SET NULL on delete |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Supports editable recipes |

**Reasoning:**
- **JSONB for ingredients/instructions** instead of TEXT — enables structured rendering, search, and future features (nutrition calc, shopping lists) without schema migrations.
- **`extracted_data` JSONB** — when a user pastes a URL, we scrape recipe metadata and store it here. Flexible schema since every site has different fields.
- **`avg_rating` + `total_cooks` denormalized** — avoids expensive aggregation queries on every feed load. Updated via triggers when users rate/cook.
- **`tags` as TEXT array** — supports GIN index for fast tag-based discovery filtering.

---

### `posts`
The social feed entity. Every item in the feed is a post.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL | References `profiles(id)` |
| `recipe_id` | UUID | References `recipes(id)`, nullable |
| `type` | TEXT | `'cook_log'`, `'recipe_share'`, `'review'`, `'tip'` |
| `caption` | TEXT | |
| `image_url` | TEXT | |
| `rating` | INTEGER 1–10 | User's rating of the recipe in this post |
| `like_count` | INTEGER | Denormalized, updated by trigger |
| `comment_count` | INTEGER | Denormalized, updated by trigger |
| `want_to_cook_count` | INTEGER | Denormalized, updated by trigger |
| `cooked_count` | INTEGER | Denormalized, updated by trigger |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Supports editable posts |

**Reasoning:**
- **Separate from recipes** — a post is the social act (sharing, reviewing, logging a cook). A recipe is the canonical data. Multiple posts can reference the same recipe.
- **Denormalized counts** — feed rendering reads one row per post with no JOINs for engagement counts. Triggers on `likes`, `comments`, `want_to_cook_actions` keep counts in sync.
- **`type` enum** — extensible for future post types without schema changes.

---

### `user_recipes`
Tracks the personal relationship between a user and a recipe. Powers the profile tabs.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL | References `profiles(id)` |
| `recipe_id` | UUID NOT NULL | References `recipes(id)` |
| `status` | TEXT | `'want_to_cook'` or `'cooked'` |
| `post_id` | UUID | References `posts(id)`, links to the cook post |
| `rating` | INTEGER 1–10 | User's personal rating |
| `cooked_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

**Unique constraint:** `(user_id, recipe_id, status)` — a user can both want-to-cook AND have cooked the same recipe.

**Reasoning:**
- **Profile "Want to Cook" tab** → `WHERE user_id = $1 AND status = 'want_to_cook'`
- **Profile "Stuff You Cooked" tab** → `WHERE user_id = $1 AND status = 'cooked'`
- **5th tab (cooked by rating)** → `WHERE user_id = $1 AND status = 'cooked' ORDER BY rating DESC`
- **"Has Cooked" button on posts** → inserts a `cooked` row here + auto-creates a `cooked_it` comment via trigger
- Partial index `idx_user_recipes_user_rating` on `(user_id, rating DESC) WHERE status = 'cooked'` makes the rankings tab fast.

---

### `likes`
Like button on posts. Composite PK prevents double-likes.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID PK | References `profiles(id)` |
| `post_id` | UUID PK | References `posts(id)` |
| `created_at` | TIMESTAMPTZ | |

**Reasoning:** Trigger increments/decrements `posts.like_count` on insert/delete.

---

### `want_to_cook_actions`
The "want to cook" button on posts. Separate from `user_recipes` to track the social action.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID PK | References `profiles(id)` |
| `post_id` | UUID PK | References `posts(id)` |
| `recipe_id` | UUID | References `recipes(id)` |
| `created_at` | TIMESTAMPTZ | |

**Reasoning:**
- Tracks which specific post triggered the bookmark (for notifications/activity feed).
- Trigger auto-upserts into `user_recipes` with `'want_to_cook'` status, so the profile tab stays in sync without the frontend needing to write to two tables.

---

### `comments`
Comments on posts. Includes system-generated "cooked it" comments.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID | References `profiles(id)` |
| `post_id` | UUID | References `posts(id)` |
| `content` | TEXT NOT NULL | |
| `type` | TEXT | `'comment'`, `'cooked_it'`, `'system'` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Reasoning:**
- **`type = 'cooked_it'`** — when someone presses "Has Cooked" on a post, a trigger auto-inserts a comment like "🍳 @username cooked this!" so it's visible in the comment thread.
- Trigger increments/decrements `posts.comment_count`.

---

### `pairwise_votes`
Head-to-head recipe comparisons for ranking.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL | References `profiles(id)` |
| `recipe_a_id` | UUID NOT NULL | References `recipes(id)` |
| `recipe_b_id` | UUID NOT NULL | References `recipes(id)` |
| `winner_id` | UUID NOT NULL | Must be one of recipe_a or recipe_b |
| `created_at` | TIMESTAMPTZ | |

**Constraints:** `recipe_a_id <> recipe_b_id`, `UNIQUE(user_id, recipe_a_id, recipe_b_id)`

**Reasoning:** Stores raw vote data. Elo scores are computed from this. Canonical ordering (a < b by UUID) prevents duplicate matchups from different directions.

---

### `recipe_elo_ratings`
Computed Elo ranking scores per recipe.

| Column | Type | Notes |
|---|---|---|
| `recipe_id` | UUID PK | References `recipes(id)` |
| `elo_score` | NUMERIC(8,2) | Default 1500 |
| `total_comparisons` | INTEGER | |
| `wins` | INTEGER | |
| `losses` | INTEGER | |
| `updated_at` | TIMESTAMPTZ | |

**Reasoning:** Trigger on `pairwise_votes` INSERT recalculates Elo for both recipes. Pre-computed scores make ranking queries O(1) via `idx_elo_score`. Standard Elo K-factor can be tuned as data grows.

---

## Key Design Decisions

1. **Denormalized counters on posts** — Feed queries read one row per post with zero JOINs for counts. Triggers maintain consistency. This is the standard pattern for social feeds at scale.

2. **JSONB over TEXT for recipe data** — Allows structured queries (`ingredients @> '[{"name": "garlic"}]'`), flexible schemas for extracted URL data, and richer frontend rendering without migrations.

3. **`user_recipes` as the central user↔recipe relationship** — One table powers three profile tabs (want to cook, cooked, ranked). Partial indexes make each query fast.

4. **Separate `want_to_cook_actions` from `user_recipes`** — The action table tracks the social event (which post, when) for notifications. The trigger auto-syncs to `user_recipes` so the profile list stays current.

5. **Elo for pairwise rankings** — Simple, well-understood algorithm. Raw votes stored in `pairwise_votes` means we can switch to Bradley-Terry or TrueSkill later without data loss.

6. **All accounts public** — RLS policies allow `SELECT` for everyone, `INSERT/UPDATE/DELETE` restricted to `auth.uid()` matching the row owner.

---

## RLS Policy Pattern

Every table follows this pattern:
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewable by everyone" ON <table> FOR SELECT USING (true);
CREATE POLICY "users can insert own" ON <table> FOR INSERT WITH CHECK (auth.uid() = <user_column>);
CREATE POLICY "users can update own" ON <table> FOR UPDATE USING (auth.uid() = <user_column>);
CREATE POLICY "users can delete own" ON <table> FOR DELETE USING (auth.uid() = <user_column>);
```

---

## Trigger Summary

| Trigger | Event | Action |
|---|---|---|
| `update_post_like_count` | `likes` INSERT/DELETE | ±1 on `posts.like_count` |
| `update_post_comment_count` | `comments` INSERT/DELETE | ±1 on `posts.comment_count` |
| `update_post_want_to_cook_count` | `want_to_cook_actions` INSERT/DELETE | ±1 on `posts.want_to_cook_count` |
| `update_post_cooked_count` | `user_recipes` INSERT (cooked) | +1 on `posts.cooked_count` |
| `auto_comment_on_cook` | `user_recipes` INSERT (cooked) | Insert `cooked_it` comment |
| `auto_bookmark_want_to_cook` | `want_to_cook_actions` INSERT | Upsert `user_recipes` (want_to_cook) |
| `update_recipe_avg_rating` | `user_recipes` INSERT/UPDATE | Recalc `recipes.avg_rating` |
| `update_recipe_total_cooks` | `user_recipes` INSERT (cooked) | +1 on `recipes.total_cooks` |
| `update_elo_on_vote` | `pairwise_votes` INSERT | Recalc Elo for both recipes |
| `set_updated_at` | Any UPDATE on posts/recipes/profiles/comments | Set `updated_at = NOW()` |
| `handle_new_user` | `auth.users` INSERT | Auto-create `profiles` row |
