# Potluck — Agent Context

Potluck is a social recipe-sharing app built with **Next.js (App Router) + Supabase**. Users share, log, and rank recipes they've cooked. The codebase is **plain JavaScript** (not TypeScript).

---

## Dev Commands

```bash
npm run dev       # Start local dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
```

Supabase is managed via the Supabase dashboard (cloud). There is no local Supabase CLI setup — do not run `supabase start` or `supabase db push`.

---

## Project Structure

```
app/
  (auth)/         # Auth routes: login, signup, etc.
  (main)/         # Main app routes: feed, discover, profile, etc.
  layout.js       # Root layout with providers
  page.js         # Root page (redirect logic)
components/       # Shared UI components
contexts/
  AuthContext.js  # Global auth state via React Context
lib/
  supabase.js         # Browser client (createBrowserClient)
  supabase-server.js  # Server client (createServerClient, for Server Components + Actions)
middleware.js     # Auth session refresh — runs on every request
```

---

## Supabase Client Rules

**This is the most important section. Get this wrong and auth will silently break.**

- **Server Components, Route Handlers, Server Actions** → always import from `lib/supabase-server.js`
- **Client Components** → always import from `lib/supabase.js`
- **Never** call Supabase directly from a Client Component for anything that requires auth context — use Server Actions instead
- `middleware.js` handles session refresh automatically — do not replicate this logic elsewhere
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client

---

## Context Files

Read these before making any significant changes:

| File | What it covers |
|---|---|
| `FEATURES.md` | Full feature scope, domain reasoning, and UI structure |
| `DATABASE_SCHEMA.md` | All tables, columns, relationships, triggers, and RLS policies |
| `INVARIANTS.md` | Hard rules that must never be violated |

---

## Key Architectural Rules

These are the most common ways agents go wrong on this codebase:

1. **Feed queries must filter by follows** — never return posts from users the viewer doesn't follow. Always join through the `follows` table.

2. **Never duplicate trigger logic in application code** — likes, comments, want-to-cook, and has-cooked counts are maintained by database triggers. Do not write app-layer code to update these counts.

3. **Soft deletes only on posts** — posts have a `deleted_at` column. Never hard delete. All post queries must include `WHERE deleted_at IS NULL`.

4. **Elo updates must be transactional** — both recipes in a pairwise vote must update atomically. No partial writes.

5. **URL metadata extraction is server-side only** — clients submit a URL and nothing else. The server fetches and parses all recipe metadata.

6. **Recipes are globally readable; posts are follower-gated** — RLS on `recipes` allows public SELECT. RLS on `posts` restricts to the author and their followers.

7. **Do not add TypeScript** — the project is plain JS. Do not introduce `.ts`/`.tsx` files or type annotations.

---

## RLS Pattern

All user-owned tables follow this pattern — do not deviate from it:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewable by everyone" ON <table> FOR SELECT USING (true);
CREATE POLICY "users can insert own" ON <table> FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users can update own" ON <table> FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users can delete own" ON <table> FOR DELETE USING (auth.uid() = user_id);
```

Exception: `posts` and `comments` have follower-scoped SELECT (see `FEATURES.md §4`).

---

## What's Not Built Yet (MVP Scope)

Do not build these unless explicitly asked:

- Private/public profile toggle (`is_private` is anticipated but not implemented)
- Global recipe leaderboard (Elo is per-user, not global)
- Invite system (registration is open)
- Notifications (triggers store data for this, but no UI)
