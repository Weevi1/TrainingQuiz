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
- [2026-03-06] Trainer clock skew caused instant quiz end → `timerStartedAt` used trainer's `Date.now()` which was 8 min behind real time. Participants calculated negative remaining time → quiz ended instantly with 0% for all. Fix: all devices now use `serverNow()` from `lib/timerSync.ts` which adds Firebase RTDB `/.info/serverTimeOffset` to `Date.now()`, giving every device server-accurate time regardless of local clock. Trainer writes anchors in server time, participants calculate elapsed in server time — no skew possible.
- [2026-02-21] Duplicate quiz used `Date.now()` for IDs → Use `crypto.randomUUID()` for new question IDs
- [2026-03-12] Correct/incorrect feedback overlay stuck over interstitial slide → `showResult` was still `true` when `nextQuestion()` showed the interstitial. Fix: clear `setShowResult(false)` in the setTimeout callback BEFORE calling `nextQuestion()`, with `requestAnimationFrame` to ensure the overlay unmounts visually before the slide mounts. Sequence: feedback overlay → clear → slide → next question.

## Session Data Integrity
- [2026-03-16] Session report showed 135% score and 27/20 correct for a 20-question quiz → Root cause: AdminSessionDetails fetched the LIVE quiz document (`getQuiz(orgId, quizId)`) instead of session-time data. Quiz was edited after the session (questions removed), so `quiz.questions.length` no longer matched the answers recorded during the session. Fix: (1) Snapshot quiz onto session at start time (`gameData.quizSnapshot`), (2) AdminSessionDetails and pdfExport prefer snapshot over live quiz, (3) `scoreToPercentage` in SessionControl now calculates true max score accounting for boss multipliers. Lesson: **never use live document state for historical reporting** — always snapshot at the point-in-time that matters.
- [2026-03-16] Jumped to "duplicate answer submissions" as root cause without evidence → Investigated code paths thoroughly but the real cause was a data model issue (live vs snapshot). Lesson: **check the data model assumptions first** before chasing code-level race conditions. When a report shows impossible numbers, the first question should be "is the data source correct?" not "how did the code produce bad data?"

## Firestore / Save Bugs
- [2026-03-16] Deleting a quiz question then saving failed with "Unsupported field value: undefined" → `interstitials` was set to `undefined` when empty. Firestore `updateDoc()` rejects `undefined` values. Fix: set to `[]` instead. Don't add generic undefined-stripping in the service layer — that masks bugs. Fix at the source.

## Firestore Updates
- [2026-03-05] Branding field overwrite: `branding: { ...org.branding, field: value }` replaces the ENTIRE branding object with a stale copy, wiping fields set by other operations → Always use Firestore dot notation: `'branding.logo': url`, `'branding.stickers': [...]`. Each field updates independently without touching others.

## Theming
- [2026-01-29] CSS variables inside white result cards break contrast → Hardcode accessible colors (e.g. `#dcfce7`, `#166534`) inside `rgba(255,255,255,0.95)` cards. Exception: `LeaderboardSection` uses `var(--surface-color)`

## Presenter View
- [2026-01-29] Questions shown on presenter screen → Never show questions on presenter — only participant progress (name, avatar, answered count, score)

## FFmpeg WASM
- [2026-03-12] FFmpeg WASM `ffmpeg.load()` hangs silently when Vite bundles the worker module → Copy `@ffmpeg/core` and `@ffmpeg/ffmpeg` worker files to `public/ffmpeg/`, pass `classWorkerURL` to `ffmpeg.load()` to bypass Vite's worker bundling. Self-host the WASM instead of loading from unpkg.com CDN.
- [2026-03-12] Don't use FFmpeg client-side conversion for slide images (PNG/JPG/WebP) — only for GIFs and videos that benefit from MP4 optimization.

## Popup Window Bootstrap
- [2026-03-12] Popup window opened via `window.open()` loads a fresh app instance (slow cold start) → Use localStorage to pass auth/org state from parent. Write before `window.open()`, read synchronously in `useState()` initializer in AuthProvider. Key pitfalls: (1) `window.opener` is null in Brave/some browsers — don't rely on it, (2) `sessionStorage` is NOT shared with popups — use `localStorage`, (3) `useEffect` runs AFTER first render so BroadcastChannel misses the ProtectedRoute check — must be synchronous via useState initializer, (4) ProtectedRoute checked `firebaseUser` which bootstrap can't provide — check `user` only.

## Deployment
- [Always] Deployed to wrong Firebase project → This project deploys to `traind-platform`. NEVER deploy to `gb-training`. Always run `firebase deploy` from `/home/aiguy/projects/Traind/`
- [2026-03-05] Firebase Storage rules never deployed → media assets (stickers, reactions) returned 403. Always run `firebase deploy --only storage` after modifying `storage.rules`. Firestore rules and Storage rules are deployed separately.

## Sound
- [2026-01-29] Sounds playing on wrong screens → Presenter handles ALL sounds except correct/incorrect (phones only). No sounds on join page. Results: celebration only for award winners (80%+)

## PDF Exports
- [2026-03-09] Individual certificate downloads (one per participant) caused browser download blocking and required user interaction for each → Merge all certificates into a single PDF using a shared `drawCertificatePage()` helper. Pre-load images once, reuse for all pages.
- [2026-03-09] CSV attendance export not useful for trainers who need printable documents → Replace with landscape A4 PDF attendance register with org logo and formatted table.
- [2026-03-09] Certificate fields (speaker, venue, cpdCategory) initially placed at org level → These are session-specific, not org-wide. Store on `GameSession`, set in SessionCreator. Org level only stores design choices (template, companyDescriptor, signature, signer). Don't hijack `signerTitle` for unrelated purposes (company descriptor) — add a dedicated field instead.
- [2026-03-17] PDF sections overflowed page boundaries, table headers orphaned at page bottom → Never hardcode page break Y thresholds (e.g. `if (yPos > 235)`). Use an `ensureSpace(pdf, yPos, neededMm)` helper that checks against a `PAGE.maxY` constant and adds a page if needed. For autoTable: always set `showHead: 'everyPage'`, `rowPageBreak: 'avoid'`, and `margin.bottom` to respect footer area. Calculate actual content height before rendering, not after.
- [2026-03-17] Session report too long with detailed per-participant analysis → Split into focused documents: Session Report (overview + question analysis) and Detailed Analysis (per-participant wrong answers) as separate downloads. Shorter, purpose-driven PDFs are more useful than one monolithic report.

## Presenter Results
- [2026-03-17] Podium ranking disagreed with leaderboard table (Nancy showed 3rd on podium but 2nd in table) → Root cause: podium derived its order from `awardResults.topPerformers` (computed in SessionControl's useMemo) while the table derived from `buildLeaderboard` (computed inside PresenterResultsSummary). Two separate sorts of the same data can diverge if participants update between renders. Fix: derive podium from the same `entries` array as the table. **One sort, one truth** — never have two components independently sorting the same data for display.

## Cost at Scale
- [2026-03-17] `submitAnswer()` wrote to a separate `answers` subcollection that was never read — pure waste (1 write/question/participant). The `gameState.answers` array on the participant doc is the actual source of truth for all reports, awards, and presenter stats. → Before adding a write path, verify something reads it. Orphaned write paths are invisible cost leaks.
- [2026-03-17] Real-time `onSnapshot` listener on participants collection in PlaySession (for live rank) caused N×N reads — every participant's state change notified every other participant → Use polling (10s interval) instead of real-time listeners when the data is "nice to have" (rank badge) rather than critical. Reserve `onSnapshot` for the presenter who truly needs real-time updates.
- [2026-03-17] `subscribeToOrganizationSessions()` had no `limit()` — loaded ALL historical sessions on every admin page visit → Always add `limit()` to Firestore collection queries, even in admin pages. Add pagination UI ("Load More") to handle overflow.
- [2026-03-17] `findUserInAnyOrganization()` scanned all org docs to find a user at login — O(N orgs) → Added `userOrgIndex/{userId}` reverse-lookup collection for O(1). Backfills on first fallback hit. Write index whenever user joins org.

## Billing
- [2026-01-28] Stripe assumed → Stripe unavailable in South Africa. Use manual invoicing/EFT. Annual ZAR subscriptions only
