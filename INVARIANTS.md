# Potluck — Core Invariants (MVP)

## Data Integrity

- **Posts are soft-deleted only** — never hard deleted. `deleted_at` timestamp marks removal; all queries filter it out.
- **Posts are edit-locked except for description** — after publish, only the description field may be edited. Recipe URL, images, and any extracted metadata are immutable. This ensures that anything a user saved or liked continues to point to the same content.
- **Post edits are in-place** — editing a post mutates the existing row. No versioning, no new rows. `updated_at` is updated on every edit so clients can surface "edited" state.
- **A user may only mutate rows where `user_id = auth.uid()`** — enforced via RLS on all user-owned tables (posts, comments, likes, want-to-cook, has-cooked).

## Engagement & Scoring

- **Likes, want-to-cook, has-cooked counts are server-calculated** — never trust client-supplied counts or aggregates.
- **Elo / pairwise ranking updates must be transactional** — both sides of a comparison update atomically or neither does. No partial Elo writes.
- **A user cannot vote in a pairwise comparison involving their own recipes.**
- **A user can only has-cooked, like, or want-to-cook a post once** — enforced via unique constraint, not just application logic.

## Accounts & Visibility

- **All accounts are public** — no private/hidden profile support in MVP. Do not build any visibility toggle infrastructure yet.
- **No invite system** — registration is open. No invite tokens, invite tables, or invite-gated flows.

## URL / Recipe Extraction

- **URL metadata extraction is server-side only** — clients submit a URL; the server fetches and parses metadata (title, image, description). Clients never submit pre-parsed recipe data directly.

## Feed & Discovery

- **Feed shows posts from followed users only.** Discovery tab handles non-followed content separately.
- **Cooked recipes tab ordering is by pairwise Elo rating**, descending. Client does not determine sort order.
