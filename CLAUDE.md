# Potluck - Agent Context

Potluck is a social recipe-sharing app built with **Next.js (App Router) + Supabase**. Users share, log, save, and rank recipes they have cooked. The codebase is **plain JavaScript**.

---

## Dev Commands

```bash
npm run dev
npm run build
npm run lint
```

Supabase is managed in the hosted dashboard. Do not run local Supabase CLI workflows for this project.

---

## Project Structure

```text
app/
  (auth)/         # Auth routes
  (main)/         # Main app routes
  layout.js       # Root layout with providers
  page.js         # Root redirect logic
components/
  PostCard.js
  LikeButton.js
  CommentSection.js
  RankingFlow.js  # Bucketed binary search ranking UI
  WantToCookButton.js
  BottomNav.js
contexts/
  AuthContext.js
lib/
  supabase.js
  supabase-server.js
  rankings.js     # Ranking bucket helpers and score helpers
middleware.js
```

### SQL Files

- `supabase-schema-unified.sql` - the canonical schema file.
- `supabase-schema.sql` - legacy, do not use.
- `supabase-migration-missing-tables.sql` - legacy, do not use.
- `supabase-elo-ranking.sql` - legacy, superseded by bucketed rankings.

### Legacy Components

- `components/CookSessionCard.js` - replaced by `PostCard.js`
- `components/StarRating.js` - star ratings were removed

---

## Supabase Client Rules

- Server Components, Route Handlers, and Server Actions -> use `lib/supabase-server.js`
- Client Components -> use `lib/supabase.js`
- `middleware.js` handles auth refresh
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public
- Never expose service role credentials to the client

---

## Context Files

Read these before significant changes:

- `FEATURES.md`
- `DATABASE_SCHEMA.md`
- `INVARIANTS.md`

---

## Key Architectural Rules

1. Feed queries must filter by follows.
2. All feed queries must filter `deleted_at IS NULL`.
3. Do not duplicate database trigger behavior in application code for counts and cooked side effects.
4. Current rankings come from `user_recipe_rankings`.
5. `pairwise_votes` are analytics/history only.
6. Rating is bucketed pairwise ranking, not star ratings.
7. `user_recipes` is cooked-only.
8. Want-to-cook intent stays in `want_to_cook_actions` and is post-specific.
9. URL metadata extraction is server-side only.
10. The project is plain JS. Do not add TypeScript.
11. The social feed table is `posts`, not `cook_sessions`.

---

## Current Ranking Model

- Users first choose a bucket: `loved`, `fine`, or `didnt_like`
- Then they binary-search within that bucket via pairwise comparisons
- Comparison events may be stored in `pairwise_votes`
- Final authoritative order is stored in `user_recipe_rankings`
- Display scores are derived from bucket and rank position:
  - `loved` -> 7 to 10
  - `fine` -> 4 to 7
  - `didnt_like` -> 0 to 4

---

## Not Built Yet

- Private/public profile toggle
- Global recipe leaderboard
- Invite system
- Notifications UI
- Feed-level "Has Cooked" action
