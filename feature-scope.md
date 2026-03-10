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
* **Feature Scope:** Centralized, globally accessible repository of recipes imported via URL or manually created. 
* **Primary Table:** `recipes`
* **Agent Reasoning:**
    * While *Posts* are private, *Recipes* are canonical and global. If User A (private) cooks "Kenji's Chili", User B can still discover the canonical "Kenji's Chili" recipe entity, even if they cannot see User A's specific post about it.
    * `extracted_data` (JSONB) is scoped to store unpredictable scraped metadata.
    * `avg_rating` and `total_cooks` are denormalized for immediate filtering.

### 2.3. Social Feed & Activity Logging (Posts)
* **Feature Scope:** Users post their cooking activity, share tips, or review recipes. These populate the follower-gated main social feed.
* **Primary Table:** `posts`
* **Agent Reasoning:**
    * Replaces legacy `cook_sessions`. A Post is a polymorphic entity defined by a `type` enum (`cook_log`, `recipe_share`, `review`, `tip`).
    * Aggregates interaction counts directly on the row to allow the client to render feeds without expensive `COUNT()` operations.
    * **Crucial constraint:** Queries fetching posts must validate that the requesting user follows the `post.user_id`.

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

### 2.6. Pairwise Ranking & Consensus (The "5th Tab")
* **Feature Scope:** Users vote on head-to-head matchups between recipes they have cooked to build a global trusted leaderboard.
* **Primary Tables:** `pairwise_votes`, `recipe_elo_ratings`
* **Agent Reasoning:**
    * Pairwise voting forces a definitive preference over skewed 1-5 star systems.
    * `recipe_elo_ratings` isolates heavy math from read queries, allowing the ranking tab to load instantly. Global recipe rankings are visible to everyone, aggregating the private actions of the network safely.

---

## 3. EVENT-DRIVEN AUTOMATION (TRIGGERS)

| Trigger Target | Action Triggered | System Result |
| :--- | :--- | :--- |
| `likes` / `comments` / `want_to_cook_actions` | `INSERT` or `DELETE` | Updates respective `_count` column on the parent `posts` row. |
| `user_recipes` (rating) | `UPDATE` | Recalculates `avg_rating` on the parent `recipes` row. |
| `user_recipes` (status = cooked) | `INSERT` linked to a `post_id` | Generates a `cooked_it` system comment on that post. |
| `pairwise_votes` | `INSERT` | Triggers Elo math function to update `recipe_elo_ratings` for both recipes. |

**Agent Directive:** Do not write application-layer code to duplicate these actions. Rely on the database triggers.

---

## 4. SECURITY & ACCESS PATTERNS (MVP STRICT)
* **Row Level Security (RLS) Paradigm Shift:** Unlike standard public networks, the MVP requires strictly scoped read access.
* **Read Access (SELECT):** * `recipes` and `recipe_elo_ratings`: Publicly readable (canonical data).
    * `posts`, `comments`, `likes`: Restricted. A user can only `SELECT` rows where `user_id` is their own, OR where the `user_id` exists in the `follows` table where `follower_id = auth.uid()`.
* **Write Constraints:** `INSERT`, `UPDATE`, and `DELETE` are universally restricted to `auth.uid() = user_id`.