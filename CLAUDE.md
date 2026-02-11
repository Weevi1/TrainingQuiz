# Trained - Interactive Post-Training Engagement Platform

## Document Management Rules
> **Keep this file under ~200 lines.** When completing work:
> 1. Add a dated entry to `docs/CHANGELOG.md` with details
> 2. Update "Current Status" below if needed
> 3. Do NOT add detailed completion logs here - reference docs/ instead
> 4. The Inbox/Outbox sections are managed by FIFO Ops and should stay here

## Project Overview
Multi-tenant SaaS platform for interactive post-training engagement. Trainers create quizzes, game shows, and activities; participants join via QR code on mobile.

- **Brand name**: "Trained" (not "Traind") | **Domain**: trained.fifo.systems
- **Business model**: Subscription SaaS (Basic R5k, Professional R14k, Enterprise R35k/year ZAR)
- **Target market**: Corporate trainers, educational institutions, professional development orgs
- **Platform Admin**: riaan.potas@gmail.com (PLATFORM_ADMIN role)
- **Live URL**: https://traind-platform.web.app

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Hosting)
- **Libraries**: React Router, QR Code generation, Lucide icons, jsPDF, html2canvas
- **Email**: SendGrid (send from `trained@fifo.systems`)

## Commands
```bash
cd traind-app && npm run dev          # Development server (localhost:5173)
cd traind-app && npm run build        # Production build
cd traind-app && npm install          # Install dependencies
firebase deploy --only hosting        # Deploy to Firebase (traind-platform)
firebase deploy --only firestore:rules # Deploy Firestore rules
```

## Deployment Safety
- **This project deploys to**: `traind-platform` (https://traind-platform.web.app)
- **NEVER deploy to `gb-training`** — that is the v1 app (separate project at `/home/aiguy/projects/gb-training-app/`)
- Always run `firebase deploy` from THIS directory (`/home/aiguy/projects/Traind/`) — the `.firebaserc` targets `traind-platform`
- Never use `--project gb-training` or `firebase use gb-training` in this directory

## Key Architecture Patterns

**Multi-tenant isolation**: All data scoped to `organizations/{orgId}/`. Firestore security rules enforce tenant boundaries. Users have roles (PLATFORM_ADMIN, ORG_OWNER, ORG_ADMIN, TRAINER, PARTICIPANT).

**Theming**: CSS variables set on document root via `BrandingContext.tsx`. 9 presets in `themePresets.ts`. Participant pages use `applyBranding.ts` (no auth context needed). All 46+ components use CSS variables — except elements inside white result cards (ParticipantResults.tsx) which use hardcoded accessible colors to guarantee contrast on any theme.

**Quiz session flow**:
1. Trainer creates session → QR code + session code generated
2. Participants scan QR → join waiting room (themed)
3. Trainer starts → 3-2-1-GO countdown → quiz active
4. **Participants progress independently** through questions (answer → 1.5s feedback → next)
5. **Presenter shows participant progress** (names, scores, progress bars) - NOT the questions
6. Session ends when: all complete, timer expires, or trainer clicks "End"
7. **Two-phase participant results**: personal stats shown immediately (score, streak, achievements); leaderboard deferred until session ends (live Firestore subscription triggers reveal with fresh data)
8. Attendance certificate (if enabled by org) — proof of attendance only, no scores/performance

**Timer architecture (anchor-based sync)**: Presenter writes `timerStartedAt` (ms timestamp) to Firestore once on start. All devices calculate `remaining = timeLimit - Math.floor((Date.now() - anchor) / 1000)` — no drift from setInterval decrement. Pause/resume recalculates anchor. No per-second Firestore writes. Session-level timer on presenter, per-question timer on participants — both anchor-based.

**Sound distribution**: Timer/ambient/lifecycle sounds play ONLY on presenter (SessionControl). Phones get ONLY `correct` and `incorrect` answer feedback. Results page: celebration sounds only for award winners (80%+ score or bingo winners). Join page has no sounds but shows a volume tip message.

**V1 reference**: `/home/aiguy/projects/gb-training-app/frontend/` - original GB Attorneys training app (deployed separately to `gb-training` Firebase project). Key files: `QuizSession.jsx` (presenter), `QuizTaking.jsx` (participant).

**Presenter scaling (PresenterCanvas)**: All presenter screens (lobby, active quiz, results) render inside a 1920×1080 design canvas that scales uniformly via CSS `transform: scale()` to fill any screen (TVs, projectors, monitors). Uses `useViewportScale` hook with ResizeObserver.

## Project Structure
```
traind-app/src/
├── pages/           # Route components (Login, Dashboard, QuizBuilder, SessionControl, etc.)
├── contexts/        # AuthContext (multi-tenant auth), BrandingContext (theming)
├── lib/             # firebase.ts, firestore.ts, permissions.ts, themePresets.ts,
│                    # soundSystem.ts, visualEffects.ts, achievementSystem.ts, applyBranding.ts
├── hooks/           # useGameTheme.ts, useViewportScale.ts, usePresenterSounds.ts
├── components/      # LoadingSpinner, ProtectedRoute, ThemeEditor/, gameModules/
│   ├── gameModules/ # MillionaireGame, SpeedRoundGame, BingoGame, SpotTheDifferenceGame
│   └── presenter/   # PresenterCanvas, StagedReveal, ResultsPodium, AwardsCeremony,
│                    # PresenterLeaderboard, PresenterStats
└── App.tsx
```

## Landing Page
- **File**: `traind-app/public/landing.html` — dark-themed marketing page served at `/` via Firebase rewrite
- **Tech**: Standalone HTML + Tailwind CDN (no build step, copied to `dist/` by Vite)
- **Content**: Training engagement pitch, 6 features, 3-step how-it-works, from R5,000/month pricing
- **CTAs**: Login → `/login`, Start Free Trial → `/register`
- **Cache**: `no-cache` header in `firebase.json`

## Current Status

**Complete (Phases 1-4):** Multi-tenant platform, 4 game modules with sound/effects/achievements, full theming, participant mobile experience, PDF reports, session flow, anchor-based timer sync, sound distribution (presenter vs phone).

**Recent (February 2026):**
- Two-phase participant results: personal stats (score, streak, achievements) show immediately; leaderboard deferred until session ends via live Firestore subscription, then re-fetches fresh participant data for accurate rankings
- Consolidated to single attendance certificate (`attendanceCertificate.ts`) — removed achievement certificate (`certificate.ts`). No scores/pass-fail on certificates, attendance proof only. White background, tenant branding, signature support.
- Removed Export PDF button from presenter completed screen (was visible on projected display)
- Fixed `confidence: undefined` breaking all Firestore gameState writes (root cause of participant progress not showing)
- Presenter full redesign: lobby (QR hero + participant tiles), active quiz (large timer, full-width progress bars), removed sidebar
- Presenter viewport scaling: PresenterCanvas (1920×1080 design canvas, CSS transform scale)
- Staged results reveal: StagedReveal slideshow with auto-advance, presenter celebration sounds
- Fixed stale closure bug in `updateSessionStats`
- Participant results contrast fix: hardcoded accessible colors inside white cards

**Recent (January 2026):**
- Attendance certificate v2: print-friendly white background, tenant branding colours (primary/secondary), larger logo, hex-to-RGB helper
- Sound system rewrite: Web Audio API singleton (`soundSystem.ts`), 18 sound types
- Sound distribution: phones only get correct/incorrect; presenter handles all other audio
- Anchor-based timer sync across all devices (presenter + 4 game modules)

**Next (Phase 5):**
1. Billing integration (invoice/EFT - no Stripe in SA)
2. Additional game modules (Jeopardy, Escape Room, Assessment Scenarios)
3. Production optimizations (Cloud Functions, error handling, offline support)
4. Advanced analytics and reporting

**Known issues:** `certificate.ts` is dead code (kept but unused — achievement certificate removed). Can be deleted.

**Design rule — white card contrast**: ParticipantResults.tsx uses white cards (`rgba(255,255,255,0.95)`) on a themed gradient. Elements inside those cards MUST use hardcoded colors (e.g. `#dcfce7`, `#166534`), never CSS variables like `var(--success-light-color)` which resolve to dark colors on dark themes. The LeaderboardSection is the exception — it uses `var(--surface-color)` as its own background so CSS variables are correct there.

## Reference Documentation
- `docs/CHANGELOG.md` - All completed work with dates and details
- `docs/ARCHITECTURE.md` - Technical specs, database schema, security rules
- `docs/GAME_MODULES.md` - Game module designs and specifications
- `docs/DEVELOPMENT_ROADMAP.md` - Timeline and milestones

---

## FIFO Ops Integration

This project reports to **FIFO Ops** (ops.fifo.systems) for centralized task and context tracking.

### Reading from Ops
Check `/home/aiguy/projects/fifo-ops/FIFO_OPS_STATE.md` for current business priorities.

### Writing to Ops
Add items to the Outbox below if you identify cross-project tasks, blockers, or decisions.

---

## Inbox from FIFO Ops
> Last updated: 2026-01-29

### Email Architecture Decision (2026-01-29)
All FIFO products use the same email setup:
- **Sending (automated)**: SendGrid, domain-verified for fifo.systems. Send from `trained@fifo.systems`.
- **Receiving**: Cloudflare Email Routing (free) — all @fifo.systems forwards to Gmail.
- **No email hosting needed.** No Google Workspace.

### Active Tasks for This Project
- [CRITICAL] Set up ESI Law as a new tenant with legal-professional branding. Presentation-ready before demo.

### Client Context
- **ESI Law**: Law firm, first look client, ready to pay. Create tenant via Platform Admin, test full participant flow end-to-end, verify branding on all participant-facing pages.

### What to work on
1. Create ESI Law tenant with legal-professional theme preset
2. Test full session flow: create quiz → QR → join → play → results
3. Verify branding on all participant-facing pages
4. Flag any issues to Ops via outbox

---

## Outbox for FIFO Ops

<!--
Format: - [DATE] [PROJECT: trained] [PRIORITY: low/medium/high] Description
Items will be processed and removed by FIFO Ops sync.
-->

<!-- All items processed by FIFO Ops on 2026-01-29 -->
