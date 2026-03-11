# POTLUCK MVP: FEATURE SCOPE AND SYSTEM REASONING
**Target Audience:** AI Development Agents, System Architects
**System Goal:** A trusted, anti-performative social cooking application where users share, log, and rank recipes they have actively cooked.



## 1. ARCHITECTURAL PRINCIPLES
* **Privacy-First MVP:** The feed and user activity are strictly scoped to a user's social graph (people they follow). The system must support transitioning to public profiles in the future without schema migrations.
* **Decoupling of Social vs. Canonical Data:** Social interactions (Posts) are strictly separated from canonical food entities (Recipes). 
* **O(1) Feed Reads via Denormalization:** Heavy read operations (feeds, profiles) rely on denormalized counter columns updated asynchronously via database triggers.
* **Structured Extensibility:** External recipe data and instructions utilize `JSONB` to accommodate varied web-scraping outputs natively.

---

## 2. FEATURE SCOPE & DOMAIN REASONING

### 2.1. User Identity & Privacy-Gated Social Graph
* **Feature Scope:** Users create profiles, follow friends, and view activity *only* from approved connections. 
* **Primary Tables:** `profiles`, `follows`
* **Agent Reasoning:** * The MVP restricts feed visibility. Agents must ensure feed queries strictly `JOIN` or filter via the `follows` table.
    * To future-proof for public accounts, agents should anticipate (or implement) an `is_private` boolean on the `profiles` table. For the MVP, treat all accounts as if `is_private = true`.

### 2.2. Canonical Recipe Management
* **Feature Scope:** Centralized, globally accessible repository of recipes imported via URL or manually created. Recipes are editable by their original creator.
* **Primary Table:** `recipes`
* **Agent Reasoning:**
    * While *Posts* are private, *Recipes* are canonical and global. If User A (private) cooks "Kenji's Chili", User B can still discover the canonical "Kenji's Chili" recipe entity, even if they cannot see User A's specific post about it.
    * `extracted_data` (JSONB) is scoped to store unpredictable scraped metadata.
    * `avg_rating` and `total_cooks` are denormalized for immediate filtering.
    * Recipes have a `created_by` field scoped to `auth.uid()`. Only the original creator may `UPDATE` a recipe's fields. RLS must enforce this.

### 2.3. Social Feed & Activity Logging (Posts)
* **Feature Scope:** Users post their cooking activity, share tips, or review recipes. These populate the follower-gated main social feed. Posts are editable after creation.
* **Primary Table:** `posts`
* **Agent Reasoning:**
    * Replaces legacy `cook_sessions`. A Post is a polymorphic entity defined by a `type` enum (`cook_log`, `recipe_share`, `review`, `tip`).
    * Aggregates interaction counts directly on the row to allow the client to render feeds without expensive `COUNT()` operations.
    * **Crucial constraint:** Queries fetching posts must validate that the requesting user follows the `post.user_id`.
    * Posts support editing (`UPDATE`) by the author. RLS write constraints already enforce `auth.uid() = user_id`; no additional access logic is needed.
    * **End-of-feed CTA:** When the client renders the last post in the feed (i.e., no further pagination results), it must display a prompt directing the user to the Discover tab to find more people to follow. This is a client-side rendering concern, not a database concern.

### 2.4. Intent & History Tracking (Want to Cook / Cooked)
* **Feature Scope:** Users bookmark recipes to cook later, or log completion.
* **Primary Tables:** `user_recipes`, `want_to_cook_actions`
* **Agent Reasoning:**
    * `user_recipes` acts as the state machine for a user's relationship with a recipe (`want_to_cook` -> `cooked`).
    * `want_to_cook_actions` captures the social event of bookmarking from a specific friend's post, enabling targeted notifications.

### 2.5. Engagement (Likes & Comments)
* **Feature Scope:** Users interact with posts visible in their feed via likes and text/system comments.
* **Primary Tables:** `likes`, `comments`
* **Agent Reasoning:**
    * When a user clicks "Has Cooked" on a friend's post, the system automatically generates a `cooked_it` comment. This creates organic activity without manual typing.

### 2.6. Pairwise Ranking — Beli-Style Binary Search Insertion
* **Feature Scope:** When a user logs a new cook, they rank it against their existing cooked recipes via a **binary search of pairwise comparisons**. Each comparison is a simple A/B vote ("Which did you prefer?"). After ~log2(n) comparisons, the recipe is inserted at the correct position. The result is a personal ranked recipe list displayed on the "Have Cooked" profile tab, with scores normalized to a **0–10 scale** where the top recipe is always 10.
* **Primary Tables:** `pairwise_votes`, `recipe_elo_ratings`
* **Agent Reasoning:**
    * **Binary search insertion flow:** The system presents the user's middle-ranked recipe first. Based on the user's preference, it halves the search space and presents the next comparison. This repeats until the insertion point is found. If the user has 0 existing cooked recipes, no comparisons are needed (the recipe is auto-ranked #1).
    * **Elo as underlying score:** Each pairwise vote updates both recipes' Elo scores via a database trigger (K=32, standard formula). Raw Elo scores determine sort order.
    * **0–10 normalized display:** The user's highest Elo recipe always displays as **10.0**. All other recipes scale proportionally: `display_score = (recipe_elo / max_elo) * 10`. This normalization is computed client-side from raw Elo — no extra DB column needed.
    * `recipe_elo_ratings` is scoped per user via composite key `(user_id, recipe_id)` — it represents *that user's* personal ranking, not a global leaderboard.
    * **Users rank all recipes they have cooked, including their own.** The ranking system is personal and covers every recipe in the user's cooked list.
    * The "Have Cooked" profile tab renders recipes ordered by personal Elo score descending with the normalized 0–10 display score.
    * This is explicitly **not** a global aggregate leaderboard in the MVP. Global consensus rankings are a future feature.

---

## 3. EVENT-DRIVEN AUTOMATION (TRIGGERS)

| Trigger Target | Action Triggered | System Result |
| :--- | :--- | :--- |
| `likes` / `comments` / `want_to_cook_actions` | `INSERT` or `DELETE` | Updates respective `_count` column on the parent `posts` row. |
| `user_recipes` (rating) | `UPDATE` | Recalculates `avg_rating` on the parent `recipes` row. |
| `user_recipes` (status = cooked) | `INSERT` linked to a `post_id` | Generates a `cooked_it` system comment on that post. |
| `pairwise_votes` | `INSERT` | Triggers Elo math function (K=32) to update `recipe_elo_ratings` for both recipes atomically. |

**Agent Directive:** Do not write application-layer code to duplicate these actions. Rely on the database triggers.

---

## 4. SECURITY & ACCESS PATTERNS (MVP STRICT)
* **Row Level Security (RLS) Paradigm Shift:** Unlike standard public networks, the MVP requires strictly scoped read access.
* **Read Access (SELECT):** * `recipes` and `recipe_elo_ratings`: Publicly readable (canonical data).
    * `posts`, `comments`, `likes`: Restricted. A user can only `SELECT` rows where `user_id` is their own, OR where the `user_id` exists in the `follows` table where `follower_id = auth.uid()`.
* **Write Constraints:** `INSERT`, `UPDATE`, and `DELETE` are universally restricted to `auth.uid() = user_id`.

---

## 5. CLIENT UI STRUCTURE

### 5.1. Tab Navigation (Bottom Bar)
The app has four primary tabs in the following order:
1. **Feed** — Follower-gated post feed (§2.3)
2. **Discover** — Browse canonical recipes and find users to follow (§2.2)
3. **Add Recipe** — Import via URL or create manually (§2.2)
4. **Profile** — The current user's profile (§5.2)

### 5.2. Profile Tab Layout
The profile has three sub-tabs:
* **Your Recipes** — Recipes the user created or imported. Distinguishes between recipes authored by the user vs. sourced elsewhere.
* **Want to Cook** — Recipes bookmarked via the `want_to_cook` state in `user_recipes`.
* **Have Cooked** — Recipes with `status = cooked` in `user_recipes`.

A fifth tab (see §2.6) renders the user's personal pairwise-ranked recipe list.

### 5.3. Profile-Level Social Metrics
In addition to follower/following counts, a user's profile displays:
* **Want to Cook count** — Total number of times other users have bookmarked any recipe this user created.
* **Have Cooked count** — Total number of times other users have logged cooking any recipe this user created.

These function as recipe-impact metrics analogous to follower counts. They should be denormalized columns on `profiles` and updated via database triggers on `want_to_cook_actions` and `user_recipes` respectively. Agents must scope these counters to activity on recipes where `recipes.created_by = profile.user_id`.