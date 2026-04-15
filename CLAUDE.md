# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Key Rules

1. The project is **plain JavaScript**. Do not add TypeScript.
2. Feed queries must filter by `follows` AND `deleted_at IS NULL`.
3. Do not duplicate database trigger behavior in app code (counters, cooked side effects, auto-comments).
4. Current rankings come from `user_recipe_rankings`. `pairwise_votes` are analytics/history only.
5. Rating is bucketed pairwise ranking, not star ratings.
6. `user_recipes` is cooked-only. Want-to-cook intent stays in `want_to_cook_actions` (post-specific).
7. URL metadata extraction is server-side only.
8. The social feed table is `posts`, not `cook_sessions`.
9. All components are client-side (`"use client"`).
10. **Supabase client split:** Server Components/Route Handlers/Server Actions use `lib/supabase-server.js`. Client Components use `lib/supabase.js`. Never expose service role credentials to the client.

---

## Build & Validation Commands

```bash
npm run test         # Vitest — unit tests for pure logic (rankings, helpers)
npm run lint         # ESLint with next/core-web-vitals — catches React/Next.js anti-patterns
npm run build        # Next.js production build — catches compile errors, bad imports, SSR issues
npm run dev          # Start dev server at localhost:3000
```

Run a single test file: `npx vitest run lib/rankings.test.js`

**After making changes, always run `npm test`, `npm run lint`, and `npm run build` to validate.** Test files live next to their source (e.g., `lib/rankings.test.js`).

### Environment Variables

The app requires these in `.env.local` (not committed):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public key

Supabase is managed in the hosted dashboard — do not run local Supabase CLI workflows.

---

## Context Files

Read these before significant changes:

- `FEATURES.md` — feature scope and system reasoning
- `DATABASE_SCHEMA.md` — schema design, RLS policies, trigger summary (**Note:** still references the old `recipe_elo_ratings` / Elo system; the codebase now uses `user_recipe_rankings` with bucketed ranking)
- `INVARIANTS.md` — what must stay true

---

## Tech Stack

- **Next.js 16 (App Router)** with plain JavaScript
- **Supabase** (auth, database, RLS)
- **Tailwind CSS v4** for styling
- **React 19**
- Path alias: `@` maps to the project root (via `jsconfig.json`)

---

## Project Structure

```text
app/
  (auth)/login, signup     # Unauthenticated routes
  (main)/                  # Authenticated routes (layout adds BottomNav)
    feed/                  # Social feed (follow-filtered)
    discover/              # Non-followed content
    post/                  # Log a cook / add recipe (with URL import)
    profile/               # Current user profile
    profile/[id]/          # Other user's profile
    recipe/[id]/           # Recipe detail
    session/[id]/          # Post detail
  layout.js                # Root layout (AuthProvider)
  page.js                  # Root redirect (authed -> /feed, else -> /login)
components/
  PostCard.js              # Feed post rendering
  LikeButton.js
  CommentSection.js
  RankingFlow.js           # Bucketed binary search ranking UI
  WantToCookButton.js
  HaveCookedButton.js      # Triggers ranking flow
  BottomNav.js
contexts/
  AuthContext.js            # Auth state (user, loading, signOut, refreshProfile)
lib/
  supabase.js              # Client-side Supabase instance
  supabase-server.js       # Server-side Supabase instance
  rankings.js              # Bucket config, sorting, score computation, recipe text parsing
middleware.js               # Auth refresh (3s timeout), route guards
```

### API Routes

- `app/api/scrape-recipe/route.js` — POST endpoint for server-side recipe extraction from URLs (JSON-LD parsing). Used by the "Import from URL" button in the new-recipe form.

### SQL Files

- `supabase-schema-unified.sql` — the canonical schema file
- `supabase-schema.sql`, `supabase-migration-missing-tables.sql`, `supabase-elo-ranking.sql` — legacy, do not use

### Legacy Components (do not use)

- `components/CookSessionCard.js` — replaced by `PostCard.js`
- `components/StarRating.js` — star ratings were removed

---

## Ranking Model

Users rank recipes via bucketed binary search insertion:

1. **Bucket selection** — `loved`, `fine`, or `didnt_like`
2. **Binary search** — pairwise comparisons against recipes already in that bucket (~log2(n) comparisons)
3. **Persist** — recipe inserted at computed position, all rankings in bucket rebalanced

Authoritative state: `user_recipe_rankings` (bucket + rank_position).

Display scores derived from bucket and position:
- `loved` -> 7 to 10
- `fine` -> 4 to 7
- `didnt_like` -> 0 to 4

Ranking helpers live in `lib/rankings.js` (`RANKING_BUCKETS`, `getBucketScore`, `sortRankings`, etc).

---

## Not Built Yet

- Private/public profile toggle
- Global recipe leaderboard
- Invite system
- Notifications UI
- Feed-level "Has Cooked" action
