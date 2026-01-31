# Trained Platform - Changelog

All completed milestones, bug fixes, and feature work. Most recent first.

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
