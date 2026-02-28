# Trained Platform - Changelog

All completed milestones, bug fixes, and feature work. Most recent first.

---

## February 27, 2026 - Interstitial Animations Between Quiz Questions

### Feature: Animation Breaks
- **Trainer-configurable interstitials**: Trainers can add animated breaks between quiz questions in the QuizBuilder — motivational messages like "You're doing great!", "Halfway there!", "Final question!" with emoji, sound, and visual effects.
- **4 style presets**: Energetic (orange/amber gradient, bounce), Calm (blue gradient, fade-up), Dramatic (dark purple gradient, zoom), Celebration (green/purple gradient, confetti).
- **Full-screen overlay**: InterstitialOverlay component renders on participant phones with themed gradient background, large emoji, message text, and progress bar. Auto-dismisses after configurable duration (1.5-5s).
- **Sound + visual effects**: Each interstitial can trigger a sound (ding, whoosh, fanfare, celebration, achievement, streak) and visual effect (confetti, particle burst, screen flash).
- **Quick-add templates**: "Auto-add breaks" button inserts preset motivational messages at 0%, 25%, 50%, 75%, and before-last-question positions.
- **Quiz duplication**: Interstitials are copied when duplicating a quiz.
- **Backwards compatible**: `interstitials` field is optional on Quiz type — existing quizzes work unchanged.

### Data Model
- New types: `InterstitialStyle`, `InterstitialConfig` (with id, beforeQuestionIndex, text, emoji, style, sound, durationMs, effect)
- `Quiz.interstitials?: InterstitialConfig[]` — stored on the Quiz document, no new Firestore collections

### Files
- `traind-app/src/lib/firestore.ts` — New types, Quiz extended
- `traind-app/src/lib/interstitialPresets.ts` — **NEW** — Style presets, templates, sound/effect options
- `traind-app/src/components/InterstitialOverlay.tsx` — **NEW** — Full-screen overlay component
- `traind-app/src/pages/PlaySession.tsx` — Interstitial flow in LegacyQuizGame (advanceToQuestion extracted, interstitial check in nextQuestion)
- `traind-app/src/pages/QuizBuilder.tsx` — InterstitialSlot UI between question cards, CRUD handlers, auto-add button
- `traind-app/src/pages/QuizManagement.tsx` — Copy interstitials in duplicateQuiz()

---

## February 27, 2026 - Fix Post-Quiz Dark Screen & Redesign Participant Results

### Critical Bug Fix
- **Race condition in `showFinalResults()`**: When a participant finishes the last question AND the trainer ends the session simultaneously, `showFinalResults()` could be called twice (from `nextQuestion()` and Firestore subscription). Each call created a `setTimeout(() => navigate('/results'))`, causing double navigation and clobbered state — resulting in a dark/blank screen for ALL participants.
- **Fix**: Added `showingFinalResultsRef` mutex to prevent double invocation. Fixed Firestore subscription (line 630) to set `sessionEndedRef.current = true` synchronously (was only setting React state, which updates async).
- **Scope bug**: `refreshingLeaderboard` state was defined inside `ParticipantResults` but referenced by `QuizResults` and `BingoResults` (module-scope components) — now properly passed as a prop.
- **Error recovery**: `handleGameComplete()` wrapped in try/catch with fallback navigation — participants ALWAYS reach `/results` even if `getSessionParticipants` fails.

### Redesigned Post-Quiz Experience
- **Animated results reveal**: New 4-phase state machine in QuizResults: `score-reveal` (0-2s, animated counter 0→actual%) → `fun-facts` (2-3.5s) → `achievements` (3.5-5s) → `full-results` (5s+). CSS transitions with staggered fade-in/scale effects.
- **Personal fun facts**: Generated from individual answer data (zero Firestore reads) — fastest answer time, hot streak, all-questions-completed, tough question nailed. Max 2 facts per participant.
- **Leaderboard reveal animation**: When session completes, "The results are in!" banner shows for 1.5s before fading into full leaderboard. Auto-scrolls to leaderboard when revealed.
- **Floating certificate button**: Download certificate button appears as a floating action button at bottom of viewport once full results are visible.
- **Immediate navigation**: Removed 3-second delay in `showFinalResults()` — participants navigate to results instantly after quiz completion. The old `sessionEnded` transitional screen is kept as a minimal fallback.
- **Mid-question session end**: If trainer ends session while participant is mid-question, shows "Session ended by trainer" notification for 1.5s before navigating to results.

### Files Modified
- `traind-app/src/pages/PlaySession.tsx` — Race condition fix, immediate navigation, error recovery, mid-question handling
- `traind-app/src/pages/ParticipantResults.tsx` — Animated reveal phases, fun facts, enhanced leaderboard, floating certificate, prop fix

---

## February 26, 2026 - Branding Moved to Superuser Dashboard

### Architecture Change
- **Branding controls removed from tenant Settings**: The entire Branding tab (logo, theme editor, reactions, stickers, certificate signature) is no longer accessible to ORG_ADMINs. Only the platform admin manages branding.
- **`BrandingEditor` component** (`components/BrandingEditor.tsx`): Extracted from Settings.tsx as a standalone, org-agnostic component. Takes `orgId` + `organization` props instead of relying on auth context. Reusable by any parent that has an organization reference.
- **PlatformAdmin page** (`/admin`): Added route to App.tsx. Existing "Manage" modal now has two tabs: **Subscription** (existing plan/status/expiry controls) and **Branding** (full BrandingEditor). Modal widens on Branding tab to accommodate ThemeEditor.
- **Settings.tsx cleanup**: Removed ~650 lines (entire BrandingSettings component), removed branding tab from sidebar, cleaned up unused imports (useBranding, StorageService, ThemeEditor, MediaUploader, etc.).

---

## February 26, 2026 - Team Invitation System & Email Infrastructure

### Cloud Functions (Brevo SMTP)
- **Created `functions/` directory**: Firebase Cloud Functions with TypeScript, Node 22, nodemailer.
- **`onInvitationCreated`** (dev + prod triggers): Sends branded HTML invite email via Brevo SMTP (`smtp-relay.brevo.com:587`) from `trained@fifo.systems`. Lazy transporter, Firebase Secret Manager for credentials (`BREVO_SMTP_USER`, `BREVO_SMTP_PASS` — same Brevo account as FIFO Ops / Home Digest).
- **Email template**: Professional HTML with TRAINED header, org name, role, inviter name, accept CTA button, 7-day expiry notice.

### Team Invite Flow
- **Settings → Team rewrite**: Replaced stub (mock data + `alert()`) with real Firestore-backed UI. Email input + role dropdown (Trainer/Admin) + loading states. Pending invitations section with revoke (X button). Real team member list from `organizations/{orgId}/users` collection.
- **Invitation Firestore schema**: `organizations/{orgId}/invitations/{id}` — email, role, status (pending/accepted/revoked), UUID token, inviter info, 7-day expiry.
- **AcceptInvite page** (`/invite/accept?token=...&org=...`): Token-based acceptance with login/register flow. Email match validation, expiry check, already-member detection. Dual-write: `joinOrganization()` (global user doc) + org-scoped user doc (for team list queries).
- **Firestore rules**: Added `invitations` subcollection to both dev and prod org blocks. Authenticated read (for token lookup), admin-only create, authenticated update (for acceptance).
- **Edge cases**: Duplicate invite check, expired filter, revoked state, wrong email guard, concurrent acceptance re-verification.

### Infrastructure
- Updated `firebase.json` runtime from `nodejs18` to `nodejs22`.
- Added `/invite/accept` public route to `App.tsx`.

---

## February 26, 2026 - Custom Reactions, Animated Avatars & Visual Effects on Phones

### Custom Reactions & Media Pipeline
- **FFmpeg WASM pipeline** (`mediaConverter.ts`): Client-side GIF→H.264 MP4 conversion using single-threaded `@ffmpeg/core` (no COOP/COEP headers needed). Lazy-loaded from CDN (~25MB, browser-cached). Enforces 5MB max input, 480px max for reactions, 200px max for stickers.
- **MediaUploader component**: Reusable upload widget for Settings → Branding. Shows conversion progress, grid of uploaded items with delete, accepts GIF/MP4.
- **ReactionOverlay component**: Fullscreen overlay during answer feedback. Renders custom video reactions (MP4 with `mix-blend-mode: screen`) when tenant has uploaded them, or **built-in CSS/canvas animations** as defaults:
  - Correct: Green radial pulse + floating sparkle emojis
  - Incorrect: Red radial pulse
  - Celebration: Canvas-rendered confetti (80 particles, physics-based gravity, rotation, fade-out)
- **Settings → Branding**: Two new sections — "Answer Reactions" (3 uploaders for correct/incorrect/celebration, max 3 each) and "Participant Avatars" (sticker uploads, max 12). Follows existing `handleLogoUpload` pattern.
- **Firestore types**: `MediaItem` type, `OrganizationBranding.reactions` and `.stickers` fields.
- **Storage rules**: Media path (`organizations/{orgId}/media/`) allows video/image, 5MB max.

### DiceBear Generated Avatars
- **StickerPicker** now has 3 tabs: Stickers (if org has custom), **Generated** (default), Emoji.
- Generated tab shows 8 DiceBear avatar styles (Fun Emoji, Robot, Character, Thumbs, Portrait, Sketch, Pixel, Shapes) personalized to the participant's name via `api.dicebear.com/9.x/` HTTP API.
- Zero npm dependencies — uses CDN API, SVGs cached by browser.
- Avatars regenerate as the participant types their name.

### Styled Emoji Avatars
- Emoji now render inside **colored circles** (12-color vibrant palette, deterministic per emoji).
- Consistent styling in both `AvatarDisplay` (all rendering contexts) and `StickerPicker` (selection grid).
- `AvatarDisplay` detects 3 avatar types: emoji (circle bg), DiceBear URL (`<img>`), sticker URL (`<video>`).

### Visual Effects on Participant Phones
- **PlaySession LegacyQuizGame**: Now fires `screen-flash` (green/red) on correct/incorrect answers, `particle-explosion` on 4+ streaks, `celebration-confetti` on quiz completion (80%+ score).
- **ParticipantResults**: Celebration overlay now fires for all high scorers (built-in animation), not just when custom reactions are uploaded.
- SpeedRoundGame and BingoGame already had visual effects wired from previous work.

### Files
**New (6):** `AvatarDisplay.tsx`, `ReactionOverlay.tsx`, `StickerPicker.tsx`, `MediaUploader.tsx`, `mediaConverter.ts`, `builtInStickers.ts`
**Modified (12+):** `firestore.ts`, `storageService.ts`, `imageResize.ts`, `storage.rules`, `Settings.tsx`, `JoinSession.tsx`, `SessionControl.tsx`, `PlaySession.tsx`, `ParticipantResults.tsx`, `PresenterLeaderboard.tsx`, `GameDispatcher.tsx`, game modules (SpeedRoundGame, BingoGame, MillionaireGame)

---

## February 26, 2026 - Short Join Domain (joinsession.xyz) + 2-Char Session Codes

Added `joinsession.xyz` as a dedicated short domain for participants to join sessions without scanning QR codes. Trainers say "go to joinsession.xyz, code A7" instead of dictating a long URL.

**New files:**
- `joinsession/index.html` — standalone static page (Tailwind CDN, dark theme, mobile-first). Shows a large 2-char code input. Handles path-based auto-redirect (`joinsession.xyz/A7` → redirects immediately).

**Firebase multi-site hosting:**
- `firebase.json` converted from single hosting object to array with two targets: `traind` (main app) and `joinsession` (short domain)
- `.firebaserc` updated with hosting targets: `traind` → `traind-platform`, `joinsession` → `joinsession-xyz`
- Created Firebase Hosting site `joinsession-xyz`, connected `joinsession.xyz` custom domain

**Session codes shortened to 2 characters (`firestore.ts`):**
- `generateSessionCode()` now async — generates 2-char alphanumeric codes (1,296 combos)
- Checks active/waiting sessions for collisions before returning; retries up to 20 times
- All callers updated to `await`: `Dashboard.tsx`, `QuizManagement.tsx`, `SessionCreator.tsx`

**Presenter screens updated (`SessionControl.tsx`):**
- Lobby: shows "or go to **joinsession.xyz**" + large session code below QR
- QR modal: shows short domain instruction instead of full URL
- Fullscreen projector: shows `joinsession.xyz` in large text instead of `{origin}/join`
- QR codes still encode full `traind-platform.web.app/join/{CODE}` URL (no redirect hop for scanners)

**Join page updated (`JoinSession.tsx`):**
- Input maxLength changed from 6 to 2, placeholder updated to "A7"

---

## February 26, 2026 - Quiz Published/Draft System (Multi-Trainer Sharing)

Added published/draft status to quizzes so multiple trainers in an organisation can share quiz content.

**Quiz type (`firestore.ts`):**
- Added `published?: boolean` field to `Quiz` type
- Added `isPublished()` helper: treats `undefined` as `true` (backwards compat for existing quizzes), only `false` means draft
- No migration needed — existing quizzes without the field display as published

**QuizManagement (`QuizManagement.tsx`):**
- Now loads all org quizzes (was role-filtered server-side, now client-side)
- Split into two sections: "My Quizzes" (own drafts + published) and "Team Quizzes" (other trainers' published)
- Published/Draft badge on each card (green globe / grey lock)
- Publish/Unpublish toggle button on own quizzes (instant Firestore update)
- Edit/Delete restricted to own quizzes (unless `manage_content` permission)
- All trainers can Start Session or Duplicate any visible quiz
- Extracted `QuizCard` component to avoid UI duplication
- Stats cards updated: My Quizzes count, Team Quizzes count, Total Questions

**QuizBuilder (`QuizBuilder.tsx`):**
- New quizzes default to `published: false` (draft)
- Visibility toggle in settings: checkbox with descriptive label and globe/lock icon
- Fixed `trainerId` overwrite bug: editing someone else's quiz now preserves original `trainerId`

**SessionCreator (`SessionCreator.tsx`):**
- Trainers see own quizzes (draft + published) + other trainers' published quizzes
- Admins see all quizzes (unchanged)

**Dashboard (`Dashboard.tsx`):**
- Quick session modal applies same filtering: own + published

---

## February 26, 2026 - CPD (Continuing Professional Development) Points

Added CPD points support for law firms and other industries requiring CPD tracking on training certificates.

**Quiz type (`firestore.ts`):**
- Added `cpdEnabled`, `cpdPoints`, `cpdRequiresPass` optional fields to `Quiz.settings`
- Existing quizzes unaffected (`cpdEnabled` defaults to falsy)

**QuizBuilder UI (`QuizBuilder.tsx`):**
- CPD section in Advanced Settings: toggle checkbox, points input (min 1), requirement dropdown
- Two modes: "Attendance Only" (everyone earns CPD) or "Must Pass" (must meet passing score %)
- Dynamic helper text references the quiz's current passing score

**Session denormalization (`SessionCreator.tsx`):**
- CPD data copied from quiz to `session.gameData.cpd` at session creation time
- Captures `passingScore` snapshot — immutable even if quiz is later edited
- No extra Firestore reads needed for certificate generation

**Certificate rendering (`attendanceCertificate.ts`):**
- Added `cpdPoints`, `cpdRequiresPass`, `cpdEarned` to `AttendanceCertificateData` interface
- CPD line renders between score and date: "X CPD Points Awarded" in primary color, bold 12pt
- Subtitle "(Pass Required)" or "(Attendance Based)" in 8pt gray
- Only renders when `cpdEarned === true`; callers compute eligibility

**Participant certificates (`ParticipantResults.tsx`):**
- Both Bingo and Quiz certificate calls now pass CPD data
- `cpdEarned` computed from participant's `passed` status and `cpdRequiresPass` setting

**Admin bulk certificates (`AdminSessionDetails.tsx`):**
- Reads CPD from `session.gameData.cpd` (denormalized)
- Per-participant eligibility: `scorePercent >= cpd.passingScore` for pass-required
- Session info card shows CPD badge (e.g. "CPD: 2 points (pass required)")

---

## February 26, 2026 - ThemeEditor Integration in Settings → Branding

Wired the existing ThemeEditor component suite into Settings → Branding tab, giving tenants full self-service theme customization.

**Settings.tsx — ThemeEditor integration:**
- Replaced static "Current Theme Preview" (3 color swatches, no editing) with full ThemeEditor
- ThemeEditor tabs: Presets (9 gallery cards), Colors (palette editor), Typography (font picker with Google Fonts), Background (patterns/effects)
- Live preview: `onPreview` callback applies CSS variables to the page in real-time during editing via `applyBranding()`
- Save persists `themePreset`, `colors`, `typography`, `background`, `effects` to Firestore organization branding
- Reset reverts to saved state and re-applies original CSS variables

**ThemePresetGallery.tsx — Bug fix:**
- Fixed `Object.entries(presets)` on array → `presets.map(preset => ...)` using `preset.id`
- Used `preset.name` and `preset.description` directly instead of broken `getPresetDescription` function
- Removed unused `getPresetDescription` function (was missing `esi-fairytale` entry)

**Font CSS pipeline — Double-quoting bug fix:**
- `buildFontStack('Inter')` returns `"Inter", system-ui, ...` (with quotes)
- `applyBrandingToDOM` extracted `"Inter"` via `.split(',')[0].trim()` — still quoted
- `getFontFamilyCSS('"Inter"')` added another layer → `""Inter""` — invalid CSS, browser silently ignored
- Fix: Added `.replace(/['"]/g, '')` before calling `getFontFamilyCSS` in both `BrandingContext.tsx` and `applyBranding.ts`

**Tailwind config — Font variable override:**
- Added `fontFamily.sans: 'var(--font-family)'` so Tailwind's default `font-sans` and preflight respect the theme CSS variable

**ThemeEditor/index.tsx — onPreview support:**
- Added `onPreview?: (data: ThemeEditorData) => void` prop
- `useEffect` fires `onPreview` on every state change (skips initial mount via ref guard)
- Reset handler also calls `onPreview` with reset values to revert the page

**Files Modified:**
- `traind-app/src/pages/Settings.tsx`
- `traind-app/src/components/ThemeEditor/index.tsx`
- `traind-app/src/components/ThemeEditor/ThemePresetGallery.tsx`
- `traind-app/src/contexts/BrandingContext.tsx`
- `traind-app/src/lib/applyBranding.ts`
- `traind-app/tailwind.config.js`

---

## February 25, 2026 - Presenter Projector Readability Overhaul

All presenter screen text sizes bumped for room-scale viewing on projectors and large screens. Within the 1920×1080 PresenterCanvas, minimum text is now ~18px (was 12-14px in places).

**PresenterLeaderboard.tsx:**
- Title: text-xl → text-3xl, icon 18 → 28px
- Row spacing: space-y-1 → space-y-2, padding px-3 py-2 → px-5 py-3
- Rank: text-lg w-8 → text-2xl w-12
- Avatar + Name: text-base → text-2xl
- "Done" badge: text-xs → text-base, padding increased
- Score %: text-lg → text-2xl, column 70 → 100px
- Avg time: text-sm → text-xl, column 50 → 80px
- Streak: text-sm → text-xl, column 55 → 80px

**PresenterStats.tsx:**
- Stat values: text-2xl → text-4xl
- Stat labels: text-xs → text-lg
- Container: p-3 → p-5, gap-3 → gap-4

**SessionControl.tsx (lobby):**
- "presents" text: text-xl → text-2xl
- Session title: text-5xl → text-6xl
- "Scan to join": text-2xl → text-3xl
- Session URL: text-lg → text-xl
- Participant names: text-xl → text-2xl
- Bottom info strip labels: text-xl → text-2xl, values: text-2xl → text-3xl

**SessionControl.tsx (active state):**
- Timer: text-8xl → text-9xl
- Logo watermark: h-10 → h-14, timer bar: h-3 → h-4
- Status badges (DONE/BINGO!): text-sm → text-lg, padding px-3 py-1 → px-4 py-1.5
- Progress bars: h-4 → h-5
- Answered count: text-xl → text-2xl
- Score: text-2xl → text-3xl, minWidth 100 → 120px
- Bottom stats: values text-3xl → text-4xl, labels text-base → text-xl

**SessionControl.tsx (completed state):**
- "Finalising Results": text-lg → text-3xl
- Subtext: text-sm → text-xl

**Files Modified:**
- `traind-app/src/components/presenter/PresenterLeaderboard.tsx`
- `traind-app/src/components/presenter/PresenterStats.tsx`
- `traind-app/src/pages/SessionControl.tsx`

---

## February 21, 2026 - Bingo Verification Questions + 21 Quiz Rough Edge Fixes

### Bingo Verification Questions (anti-cheating)
- When a bingo session has a linked quiz, tapping a cell now shows the corresponding quiz question as a multiple-choice challenge
- Correct answer → cell is marked (with sound, score, effects)
- Wrong answer → "Incorrect — try again later" feedback, cell stays unmarked, can retry anytime
- Falls back to tap-to-mark when no quiz is linked (default training items)
- FREE center cell stays auto-marked, no question
- Question modal: themed, mobile-optimized, shows full question text (not truncated bingo cell text)
- **Files**: `BingoGame.tsx` (challenge state, `markCell` extracted, `handleChallengeAnswer`, modal UI), `GameDispatcher.tsx` (passes `questions` prop)

### Interactive Quiz Rough Edges (all 21 fixed)
From Ops code review (21 Feb 2026). Showstoppers #1-#2 fixed first, then 7 medium, then 12 low.

**Showstoppers:**
- #1 Answer double-submission: removed auto-submit setTimeout, submit immediately on selection (`PlaySession.tsx`)
- #2 Quiz null crash: added defensive defaults with optional chaining for quiz.timeLimit/questions.length (`SessionControl.tsx`)

**Medium:**
- #3 Avatar typing: removed `(p as any).avatar` casts (`JoinSession.tsx`)
- #4 Empty options validation: saveQuiz validates all questions have text and non-empty options (`QuizBuilder.tsx`)
- #5 Leaderboard refresh indicator: 500ms delayed "Refreshing..." indicator (`ParticipantResults.tsx`)
- #6 Timer drift: only update anchor when Firestore value actually changed (`SessionControl.tsx`)
- #7 Percentage calc: removed fragile score-based fallback, uses answers array (`PresenterLeaderboard.tsx`)
- #8 Pause indicator: "Session Paused by Trainer" overlay with blur backdrop (`PlaySession.tsx`)
- #9 Sessions Created stat: replaced with "Avg Questions / Quiz" computed from loaded data (`QuizManagement.tsx`)

**Low:**
- #10 Start confirmation: confirm dialog before starting session (`SessionControl.tsx`)
- #11 Duplicate quiz: clone with " (Copy)" suffix, crypto.randomUUID for new question IDs (`QuizManagement.tsx`)
- #12 Certificate error handling: try/catch with alert on failure (`ParticipantResults.tsx`)
- #13 Clipboard error handling: try/catch with fallback message (`ParticipantResults.tsx`)
- #14 Real-time session list: `subscribeToOrganizationSessions` with onSnapshot (`SessionManagement.tsx`, `firestore.ts`)
- #15 Question reorder: "Move to #" number input for quizzes with >3 questions (`QuizBuilder.tsx`)
- #16 Streak alignment: always render streak column, show "—" when < 3 (`PresenterLeaderboard.tsx`)
- #17 Sort reset: reset to rank/asc on loadData (`AdminSessionDetails.tsx`)
- #18 Loading text: "Loading questions..." instead of "Quiz is starting..." (`PlaySession.tsx`)
- #19 Delete last question: disabled delete when 1 question, disabled Save when 0 (`QuizBuilder.tsx`)
- #20 Session recovery: added sessionId truthy check (`PlaySession.tsx`)
- #21 Null question error: AlertTriangle icon + "Refresh Page" button (`PlaySession.tsx`)

### Code Review Fixes (from plan mode review)
- Added `leaderboardFetchedRef` guard to prevent duplicate participant fetches (`ParticipantResults.tsx`)
- Changed question ID generation from `Date.now()` to `crypto.randomUUID()` (`QuizManagement.tsx`)

**Files Modified (12 files):**
- `traind-app/src/lib/firestore.ts`
- `traind-app/src/pages/PlaySession.tsx`
- `traind-app/src/pages/SessionControl.tsx`
- `traind-app/src/pages/QuizBuilder.tsx`
- `traind-app/src/pages/ParticipantResults.tsx`
- `traind-app/src/pages/QuizManagement.tsx`
- `traind-app/src/pages/JoinSession.tsx`
- `traind-app/src/pages/SessionManagement.tsx`
- `traind-app/src/pages/AdminSessionDetails.tsx`
- `traind-app/src/components/presenter/PresenterLeaderboard.tsx`
- `traind-app/src/components/gameModules/BingoGame.tsx`
- `traind-app/src/components/gameModules/GameDispatcher.tsx`

---

## January 30, 2026 - Attendance Certificate v2 (Print-Friendly with Tenant Branding)

**Redesigned `attendanceCertificate.ts` for print-friendly output with tenant branding:**
- White background instead of dark navy — clean printing, no ink waste
- Outer border uses org primary colour; inner border + corner accents use org secondary colour
- Title and participant name in org primary colour; session title in org secondary colour
- Body text in dark gray (#374151), date in medium gray (#6b7280), footer in light gray (#9ca3af)
- Logo area enlarged to 50x30mm for better print visibility
- Added `hexToRgb()` helper for jsPDF colour conversion
- Fallback colours: navy (#1e3a5f) primary, dark gold (#8b6914) secondary when no branding set

**Interface updated:**
- Added `primaryColor` and `secondaryColor` optional fields to `AttendanceCertificateData`

**Callers updated to pass branding colours:**
- `ParticipantResults.tsx` — both bingo and quiz attendance certificate buttons
- `SessionControl.tsx` — both bulk and single certificate handlers

**Files Modified:**
- `traind-app/src/lib/attendanceCertificate.ts` — Full rewrite
- `traind-app/src/pages/ParticipantResults.tsx` — Pass primaryColor + secondaryColor
- `traind-app/src/pages/SessionControl.tsx` — Pass primaryColor + secondaryColor

---

## January 29, 2026 - Sound Distribution & Anchor-Based Timer Sync

**Sound Distribution Rules Applied:**
- Phones only receive `correct` and `incorrect` answer sounds during gameplay
- All timer, ambient, lifecycle, transition sounds are presenter-only (SessionControl)
- Join page: removed all sounds, added volume tip message with Volume2 icon
- Results page: celebration sounds only for award winners (80%+ score or bingo winners)
- Applied to: PlaySession, JoinSession, ParticipantResults, and all 4 game modules

**Anchor-Based Timer Sync (all devices):**
- Presenter writes `timerStartedAt` (ms timestamp) to Firestore once on session start
- All devices calculate `remaining = timeLimit - Math.floor((Date.now() - anchor) / 1000)`
- Eliminates drift from `setInterval` decrement approach
- Pause/resume recalculates anchor: `newAnchor = Date.now() - (timeLimit - remaining) * 1000`
- No per-second Firestore writes (v1 wrote every second; v2 writes anchor once)
- Page refresh resilience: `loadSession()` restores timer from Firestore anchor
- Added to `GameSession` type: `timerStartedAt`, `sessionTimeLimit`, `timerPaused`, `pausedTimeRemaining`

**Files Modified:**
- `traind-app/src/lib/firestore.ts` - Timer sync fields on GameSession type
- `traind-app/src/pages/SessionControl.tsx` - Anchor-based session timer, timer sounds, pause/resume/reset
- `traind-app/src/pages/PlaySession.tsx` - Anchor-based per-question timer, pause/resume sync, sounds stripped
- `traind-app/src/pages/JoinSession.tsx` - All sounds removed, volume tip added
- `traind-app/src/pages/ParticipantResults.tsx` - Sounds gated to 80%+ winners only
- `traind-app/src/components/gameModules/BingoGame.tsx` - Anchor timer, sounds stripped (kept correct + bingo win)
- `traind-app/src/components/gameModules/MillionaireGame.tsx` - Anchor timer, sounds stripped (kept correct/incorrect + millionaire win)
- `traind-app/src/components/gameModules/SpeedRoundGame.tsx` - Dual anchor timers (game + question), sounds stripped
- `traind-app/src/components/gameModules/SpotTheDifferenceGame.tsx` - Anchor timer, sounds stripped

---

## January 29, 2026 - Sound System Fix

**Root Cause: BiquadFilter Blocking Sounds:**
- Every sound was routed through a `BiquadFilterNode` with default lowpass at 350Hz
- Sounds that didn't set their own filter frequency (tick, ding, click, fanfare, timeWarning) were silently blocked
- Fix: Set filter default to 20kHz (passes everything), individual sounds override as needed

**Additional Sound Fixes:**
- Added try-catch + console warning in `play()` so errors aren't silently swallowed
- Fixed invalid `'select'` sound type in PlaySession.tsx → replaced with `'click'`
- Added timer tick sounds during participant quiz countdown (tick for last 30s, timeWarning for last 10s)
- Added completion sound on presenter (fanfare + celebration) when session ends

**Files Modified:**
- `traind-app/src/lib/soundSystem.ts` - Filter fix, error handling
- `traind-app/src/pages/PlaySession.tsx` - Timer sounds, fixed 'select' type
- `traind-app/src/pages/SessionControl.tsx` - Completion sounds

---

## January 29, 2026 - Presenter Results & Phone Contrast Fix

**Presenter Completed State Improved:**
- Added full participant leaderboard with rank, avatar, name, score %, accuracy, avg time, streak
- Top performers podium now shows percentage scores instead of raw points
- Final stats "Average Score" now displays as percentage
- Added `scoreToPercentage()` helper for consistent score display
- Leaderboard sorts by score (tiebreak by avg response time)
- Medal highlights for top 3 (gold/silver/bronze backgrounds)

**Phone Results Page Contrast Fixed:**
- Achievement cards: replaced theme CSS variable text colors with guaranteed dark (#1f2937)
- Performance insight cards: hardcoded light backgrounds (green, blue, yellow, orange, gold) instead of theme variables
- Insight text uses dark gray (#1f2937) for readability on any theme
- Leaderboard medal colors use hardcoded dark tones instead of theme variables
- Rank highlight section uses fixed accessible colors for non-top-3 users
- All changes apply to both QuizResults and BingoResults components

**Files Modified:**
- `traind-app/src/pages/SessionControl.tsx` - Leaderboard, percentage scores, helper function
- `traind-app/src/pages/ParticipantResults.tsx` - Contrast fixes for achievements, insights, leaderboard

---

## January 29, 2026 - Quiz Session Flow Fix

**Presenter View Redesigned:**
- SessionControl.tsx no longer shows quiz questions during active session
- Presenter now shows: participant progress (name, avatar, questions answered, score), session timer, live stats
- Follows v1 pattern: trainer sees who's progressing, not the questions themselves

**Participant Question Repetition Fixed:**
- Removed trainer-driven question index sync from PlaySession
- Participants now progress independently through questions (answer → feedback → next)
- Per-question timer runs locally on each participant's device
- Session-level timer on presenter; auto-ends when time expires or all participants complete

**Timer Architecture Changed:**
- Presenter timer changed from per-question to session-level (timeLimit * questionCount)
- Removed timer broadcaster (participants no longer mirror trainer's timer)
- Added auto-end when all participants complete the quiz

**Files Modified:**
- `traind-app/src/pages/SessionControl.tsx` - Presenter shows participant progress, not questions
- `traind-app/src/pages/PlaySession.tsx` - Removed trainer question/timer sync

---

## January 28, 2025 - Participant Theming & Permissions Fix

**Participant Theming:**
- Created `src/lib/applyBranding.ts` - Standalone branding utility for participant pages
- Supports full theme preset system with 30+ CSS variables
- Updated JoinSession, PlaySession, ParticipantResults to use new utility

**Firestore Rules:**
- Organizations: `allow read: if true` (participants can load branding)
- Quizzes: `allow read: if true` (participants can load questions)

**Avatar/Emoji Display:**
- SessionControl shows participant's chosen emoji avatar instead of index number

**Celebratory Results Page:**
- Full gradient background using organization theme colors
- Floating celebration emojis for scores 80%+
- Performance badges, achievement cards, collapsible question breakdown
- PlaySession passes complete gameState and quiz data to results

**Billing System - Stripe Removed:**
- Stripe unavailable in South Africa; switched to manual invoicing/EFT
- Annual subscriptions in ZAR: Basic R5k, Professional R14k, Enterprise R35k
- Payment Flow: Invoice → EFT payment → Platform Admin confirms → Activated

---

## January 27, 2025 - Session Flow & Theming

**Session Flow Fixes:**
- `findSessionByCode()` was broken (returned null) - fixed Firestore query
- QuizManagement "Start Session" button now creates session and navigates to waiting room
- Dashboard quick session modal for faster session creation

**Rich Tenant Theming System:**
- All 46+ component files converted to CSS variables
- 200+ hardcoded Tailwind colors replaced
- 9 theme presets (corporate-blue, fairytale, legal-professional, etc.)
- Theme editor UI with live preview
- Zero hardcoded colors verified by audit
- Rebranded user-facing text from "Traind" to "Trained"

---

## January 2025 - Phase 4: Enhanced Gaming Experience

**Sound System:** Web Audio API with 18 dynamic sound types
**Visual Effects:** Particle animations, screen effects, celebrations
**Achievement System:** 15+ achievements with XP, level progression, localStorage persistence
**Live Engagement:** Real-time leaderboards, floating reactions, participant tracking

**Enhanced Game Modules (4 complete):**
- Who Wants to be a Millionaire: Dramatic tension, lifelines, celebrations
- Speed Round Challenge: Rapid-fire effects, streak animations, time pressure
- Training Bingo: Cell marking sounds, bingo celebrations, streak fire
- Document Detective: Investigation theme, critical detection, achievements

---

## December 2024 - Phases 1-3

**Phase 1: Multi-Tenant Foundation**
- Multi-tenant React + TypeScript application
- Firebase/Firestore with tenant isolation
- Dynamic theming with CSS variables
- User roles: PLATFORM_ADMIN, ORG_OWNER, ORG_ADMIN, TRAINER, PARTICIPANT
- Organization registration wizard

**Phase 2: Core Platform Features**
- Organization-scoped quiz CRUD, session management, trainer dashboard
- Module access control with subscription gating
- Permission system with subscription validation

**Phase 3: Participant Experience**
- Mobile-optimized join flow with QR codes
- Real-time game sync with timers
- Live session control, analytics, results
- End-to-end flow: create session → join → play → results

**Infrastructure:**
- Migrated from Supabase to Firebase
- Scratch card giveaway system
- Synchronized timer architecture
- PDF export with detailed participant analysis
- Firebase composite indexes for performance

---

## Pre-December 2024 - Foundation

- Original TrainingQuiz system built
- Firebase Firestore real-time architecture
- QR code participant joining
- Mobile-responsive design
- Sound effects and game show animations
