# Potluck - Core Invariants

## Data Integrity

- Posts are soft-deleted only. All post reads must filter `deleted_at IS NULL`.
- Post edits are in-place. No versioning rows are created.
- Users may only mutate rows they own.
- `user_recipes` is cooked-only.
- Want-to-cook is post-specific and lives only in `want_to_cook_actions`.

## Engagement and Counters

- Likes, comments, want-to-cook counts, cooked counts, and recipe total cooks are database-maintained.
- Do not trust client-supplied aggregate values.
- A user can only like or save a given post once.
- A user can only have one cooked relationship per `(user_id, recipe_id, status)`.

## Ranking

- Current ranking state comes from `user_recipe_rankings`.
- Pairwise votes are analytics/history only.
- Ranking uses bucketed binary search insertion.
- Buckets are `loved`, `fine`, and `didnt_like`.
- Have Cooked order is bucket priority first, then `rank_position`.
- Display scores are derived client-side from bucket + rank position.

## Accounts and Visibility

- Accounts are public in the current MVP.
- Do not build invite-gated registration flows.

## URL and Recipe Data

- URL metadata extraction is server-side only.
- Ingredients and instructions are stored as JSON arrays so future parsing can enrich them without another schema change.

## Feed and Discovery

- Feed shows posts from followed users only.
- Discovery handles non-followed content separately.
