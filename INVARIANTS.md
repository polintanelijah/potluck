# Potluck — Core Invariants (MVP)

## Data Integrity

- **Posts are soft-deleted only** — never hard deleted. `deleted_at` timestamp marks removal; all queries filter it out.
- **Posts are edit-locked except for description** — after publish, only the description field may be edited. Recipe URL, images, and any extracted metadata are immutable. This ensures that anything a user saved or liked continues to point to the same content.
- **Post edits are in-place** — editing a post mutates the existing row. No versioning, no new rows. `updated_at` is updated on every edit so clients can surface "edited" state.
- **A user may only mutate rows where `user_id = auth.uid()`** — enforced via RLS on all user-owned tables (posts, comments, likes, want-to-cook, has-cooked).

## Engagement & Scoring

- **Likes, want-to-cook, has-cooked counts are server-calculated** — never trust client-supplied counts or aggregates.
- **Elo / pairwise ranking updates must be transactional** — both sides of a comparison update atomically or neither does. No partial Elo writes.
- **A user can vote on any recipe they have cooked, including their own** — the ranking system covers all recipes in a user's cooked list.
- **A user can only has-cooked, like, or want-to-cook a post once** — enforced via unique constraint, not just application logic.

## Accounts & Visibility

- **All accounts are public** — no private/hidden profile support in MVP. Do not build any visibility toggle infrastructure yet.
- **No invite system** — registration is open. No invite tokens, invite tables, or invite-gated flows.

## URL / Recipe Extraction

- **URL metadata extraction is server-side only** — clients submit a URL; the server fetches and parses metadata (title, image, description). Clients never submit pre-parsed recipe data directly.

## Ranking System

- **Ranking uses Beli-style binary search insertion** — when a user cooks a new recipe, they compare it against their existing ranked list via binary search (~log2(n) pairwise comparisons). The client drives the binary search; each vote inserts into `pairwise_votes` and the DB trigger updates Elo.
- **Display scores are 0–10, normalized to the user's top recipe** — the highest Elo recipe always displays as 10.0. Formula: `display_score = (elo / max_elo) * 10`. Normalization is computed client-side.
- **Elo scores are per-user, not global** — `recipe_elo_ratings` is keyed on `(user_id, recipe_id)`. There is no global leaderboard in MVP.
- **Have Cooked tab is ordered by Elo descending** — the client does not determine sort order.

## Feed & Discovery

- **Feed shows posts from followed users only.** Discovery tab handles non-followed content separately.
