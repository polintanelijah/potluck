# Potluck — To-Do List

## In Progress

- [ ] **Discover page onboarding** — Add subtitle "Follow people to see their recipes in your feed" and better empty state messaging
- [ ] **Font choice** — Match Beli app's typography style. Research in progress.
- [ ] **Recipe source link clarity** — Current "recipe source" link is standard but could benefit from a non-intrusive mini tutorial/tooltip for first-time users

## Known Risks — Recipe URL Auto-Populate & AI Format Gate

Open items from the `/post` URL auto-fill and anti-spam work. None block ship; revisit if any become real problems.

- [ ] **Polite fetching.** Some recipe sites (NYT Cooking, Bon Appétit behind paywall) return 403 or a login HTML page to the `Potluck/0.1` User-Agent we send. Today those just surface as "Couldn't auto-fill" and the user types by hand. If coverage becomes a real ask, consider a proper headless fetch service instead of raw `fetch`.
- [ ] **Ugly JSON-LD instructions.** A small minority of recipe sites embed `recipeInstructions` as a single HTML blob rather than a step list. Our splitter does its best on newlines/numbered prefixes; anything that slips through lands in the Instructions textarea as one long line, and the user can clean it up with Format with AI. Acceptable degradation but worth watching — if it's common, upgrade the splitter.
- [ ] **Gemini URL-fallback doubles quota exposure.** Every recipe page without JSON-LD triggers a second Gemini call. Currently mitigated by: auth gate, 12 KB text cap, JSON-LD first, "onPaste only when textareas empty", and the Already-pulled snapshot. If the free-tier quota starts getting hit, add a per-user daily cap backed by Supabase.
- [ ] **Static private-IP block list (SSRF).** The `extractRecipeFromUrl` action rejects `localhost`, `127.0.0.1`, `0.0.0.0`, `10.*`, `192.168.*`, `169.254.*`, and `172.16-31.*` by hostname string match. A production deploy should resolve the hostname first and check the *resolved* IP to cover DNS rebinding. Not worth the extra dep for a school project, but flag before any public launch.

## Tabled (Revisit Later)

- [ ] **Handle missing external apps** — Gracefully handle cases where the user doesn't have an external app installed (e.g., TikTok links). Show a fallback or open in browser instead of failing silently. Currently uses standard `<a href target="_blank">` with `https://` URLs, which should open in browser. Investigate specific failure cases before implementing.

- [ ] **Recook feed confusion** — The "recook" appearing in the feed is confusing to users. Options to consider:
  - **Option A: "Recooked" badge** — Check if earlier posts exist for the same recipe_id, show "Recooked from @originaluser" label. Clear but requires extra query/join.
  - **Option B: Visual differentiation (Recommended)** — Different card styling for recooks, show "Cooked @jane's Pasta Carbonara". Low complexity, keeps recooks visible.
  - **Option C: Collapse recooks** — Group under original post with "3 people also cooked this". Cleanest feed but most complex to implement.
  - **Option D: Hide from feed** — Only show recooks on profile, not in feed. Simplest but reduces social visibility.
