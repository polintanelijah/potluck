# POTLUCK MVP: FEATURE SCOPE AND SYSTEM REASONING

## 1. Architectural Principles

- Social activity is separate from canonical recipe data.
- Feed reads rely on denormalized counters maintained by the database.
- Recipe content uses JSON so manual entry works now and richer parsing can land later.
- Current visibility is public at the schema layer, but the app feed is still follow-filtered.

## 2. Core Domain Model

### 2.1 Profiles and Follows

- Users create profiles and follow each other.
- The home feed is derived from the `follows` graph.
- The schema should remain easy to extend with `profiles.is_private` later.

### 2.2 Recipes

- `recipes` is the reusable recipe entity.
- Recipes can be created manually now.
- When a URL is provided, users can click "Import from URL" to auto-fill title, ingredients, and instructions from the page's JSON-LD structured data.
- Ingredients and instructions are stored as JSON arrays.
- Only the creator should edit a recipe.

### 2.3 Posts

- `posts` is the social feed entity.
- A post can represent a cook log or other social activity tied to a recipe.
- Engagement counters live on the post row and are maintained by triggers.

### 2.4 Cooked vs Saved

- `user_recipes` records recipes a user has actually cooked.
- `want_to_cook_actions` records post-specific saves.
- A user may save multiple posts that point at the same recipe.

### 2.5 Engagement

- `likes` and `comments` are attached to posts.
- Saving a post uses `want_to_cook_actions`.
- Cooked side effects such as counters and cooked-it comments are database-driven.

### 2.6 Ranking

- Ranking is Beli-style bucketed insertion.
- Users first choose a bucket:
  - `loved`
  - `fine`
  - `didnt_like`
- Then the app runs binary search comparisons against recipes already ranked in that bucket.
- Final authoritative ranking lives in `user_recipe_rankings`.
- Pairwise comparisons may also be logged in `pairwise_votes` for analytics.

### 2.7 Scoring

- Scores are derived from rank position inside a bucket.
- Bucket score bands:
  - `loved` -> 7 to 10
  - `fine` -> 4 to 7
  - `didnt_like` -> 0 to 4
- A last-place loved recipe should still score above a first-place fine recipe.

## 3. Trigger-Driven Behavior

- Likes update `posts.like_count`
- Comments update `posts.comment_count`
- Want-to-cook actions update `posts.want_to_cook_count`
- Cooked inserts update `posts.cooked_count`
- Cooked inserts update `recipes.total_cooks`
- Cooked inserts can create a cooked-it comment

Application code should not duplicate these count updates.

## 4. UI Structure

### 4.1 Bottom Navigation

1. Feed
2. Discover
3. Add Recipe / Log Cook
4. Profile

### 4.2 Profile Tabs

- Your Recipes
- Want to Cook
- Have Cooked

Want to Cook renders saved posts.
Have Cooked renders the user's bucketed ranking list.

### 4.3 Add Recipe Flow

- Search existing recipes first
- Reuse an existing recipe when possible
- Only create a new `recipes` row for truly new recipes
- When creating a new recipe with a URL, offer "Import from URL" to auto-fill fields from the page
- Logging a cook should create the post, the cooked relationship, and then the ranking flow
