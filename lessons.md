# Lessons — Trained

> Patterns learned from corrections. Reviewed at session start.
> Format: `[date] What went wrong → What to do instead`

## Quiz & Session Bugs
- [2026-02-27] `showFinalResults()` called twice (Firestore subscription + quiz end) → Use a mutex ref (`showingFinalResultsRef`). When setting `sessionEndedRef` from a subscription callback, set the ref synchronously (not just React state which updates async). Always set refs BEFORE calling shared functions
- [2026-02-27] Module-scope components referencing parent-scope state → Pass state as explicit props. Components defined at module level (outside `ParticipantResults`) can NOT access variables from inside it. Esbuild/Vite doesn't type-check, so this compiles but crashes at runtime
- [2026-02-21] Answer double-submission via setTimeout → Submit immediately on selection, not via delayed auto-submit
- [2026-02-21] Quiz null crash → Add defensive defaults with optional chaining for `quiz.timeLimit`/`questions.length`
- [2026-02-21] Percentage calculation wrong → Use `answers.length` not score-based fallback for percentages
- [2026-02-21] Timer drift across devices → Use anchor-based timer: write `timerStartedAt` once, all devices calculate remaining locally. Never use `setInterval` decrement
- [2026-02-21] Duplicate quiz used `Date.now()` for IDs → Use `crypto.randomUUID()` for new question IDs

## Theming
- [2026-01-29] CSS variables inside white result cards break contrast → Hardcode accessible colors (e.g. `#dcfce7`, `#166534`) inside `rgba(255,255,255,0.95)` cards. Exception: `LeaderboardSection` uses `var(--surface-color)`

## Presenter View
- [2026-01-29] Questions shown on presenter screen → Never show questions on presenter — only participant progress (name, avatar, answered count, score)

## Deployment
- [Always] Deployed to wrong Firebase project → This project deploys to `traind-platform`. NEVER deploy to `gb-training`. Always run `firebase deploy` from `/home/aiguy/projects/Traind/`

## Sound
- [2026-01-29] Sounds playing on wrong screens → Presenter handles ALL sounds except correct/incorrect (phones only). No sounds on join page. Results: celebration only for award winners (80%+)

## Billing
- [2026-01-28] Stripe assumed → Stripe unavailable in South Africa. Use manual invoicing/EFT. Annual ZAR subscriptions only
