# Potluck — To-Do List

## In Progress

- [ ] **Discover page onboarding** — Add subtitle "Follow people to see their recipes in your feed" and better empty state messaging
- [ ] **Font choice** — Match Beli app's typography style. Research in progress.
- [ ] **Recipe source link clarity** — Current "recipe source" link is standard but could benefit from a non-intrusive mini tutorial/tooltip for first-time users

## Tabled (Revisit Later)

- [ ] **Handle missing external apps** — Gracefully handle cases where the user doesn't have an external app installed (e.g., TikTok links). Show a fallback or open in browser instead of failing silently. Currently uses standard `<a href target="_blank">` with `https://` URLs, which should open in browser. Investigate specific failure cases before implementing.

- [ ] **Recook feed confusion** — The "recook" appearing in the feed is confusing to users. Options to consider:
  - **Option A: "Recooked" badge** — Check if earlier posts exist for the same recipe_id, show "Recooked from @originaluser" label. Clear but requires extra query/join.
  - **Option B: Visual differentiation (Recommended)** — Different card styling for recooks, show "Cooked @jane's Pasta Carbonara". Low complexity, keeps recooks visible.
  - **Option C: Collapse recooks** — Group under original post with "3 people also cooked this". Cleanest feed but most complex to implement.
  - **Option D: Hide from feed** — Only show recooks on profile, not in feed. Simplest but reduces social visibility.
