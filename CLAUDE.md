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
firebase deploy --only hosting        # Deploy to Firebase
firebase deploy --only firestore:rules # Deploy Firestore rules
```

## Key Architecture Patterns

**Multi-tenant isolation**: All data scoped to `organizations/{orgId}/`. Firestore security rules enforce tenant boundaries. Users have roles (PLATFORM_ADMIN, ORG_OWNER, ORG_ADMIN, TRAINER, PARTICIPANT).

**Theming**: CSS variables set on document root via `BrandingContext.tsx`. 9 presets in `themePresets.ts`. Participant pages use `applyBranding.ts` (no auth context needed). All 46+ components use CSS variables - zero hardcoded colors.

**Quiz session flow**:
1. Trainer creates session → QR code + session code generated
2. Participants scan QR → join waiting room (themed)
3. Trainer starts → 3-2-1-GO countdown → quiz active
4. **Participants progress independently** through questions (answer → 1.5s feedback → next)
5. **Presenter shows participant progress** (names, scores, progress bars) - NOT the questions
6. Session ends when: all complete, timer expires, or trainer clicks "End"
7. Results page with leaderboard, achievements, certificate

**Timer architecture (anchor-based sync)**: Presenter writes `timerStartedAt` (ms timestamp) to Firestore once on start. All devices calculate `remaining = timeLimit - Math.floor((Date.now() - anchor) / 1000)` — no drift from setInterval decrement. Pause/resume recalculates anchor. No per-second Firestore writes. Session-level timer on presenter, per-question timer on participants — both anchor-based.

**Sound distribution**: Timer/ambient/lifecycle sounds play ONLY on presenter (SessionControl). Phones get ONLY `correct` and `incorrect` answer feedback. Results page: celebration sounds only for award winners (80%+ score or bingo winners). Join page has no sounds but shows a volume tip message.

**V1 reference**: `/home/aiguy/projects/gb-training-app/frontend/` - original GB Attorneys training app. Key files: `QuizSession.jsx` (presenter), `QuizTaking.jsx` (participant).

## Project Structure
```
traind-app/src/
├── pages/           # Route components (Login, Dashboard, QuizBuilder, SessionControl, etc.)
├── contexts/        # AuthContext (multi-tenant auth), BrandingContext (theming)
├── lib/             # firebase.ts, firestore.ts, permissions.ts, themePresets.ts,
│                    # soundSystem.ts, visualEffects.ts, achievementSystem.ts, applyBranding.ts
├── hooks/           # useGameTheme.ts
├── components/      # LoadingSpinner, ProtectedRoute, ThemeEditor/, gameModules/
│                    # (MillionaireGame, SpeedRoundGame, BingoGame, SpotTheDifferenceGame)
└── App.tsx
```

## Current Status

**Complete (Phases 1-4):** Multi-tenant platform, 4 game modules with sound/effects/achievements, full theming, participant mobile experience, PDF reports, session flow, anchor-based timer sync, sound distribution (presenter vs phone).

**Recent (January 2026):**
- Attendance certificate v2: print-friendly white background, tenant branding colours (primary/secondary), larger logo, hex-to-RGB helper
- Sound system rewrite: Web Audio API singleton (`soundSystem.ts`), 18 sound types
- Sound distribution: phones only get correct/incorrect; presenter handles all other audio
- Anchor-based timer sync across all devices (presenter + 4 game modules)
- Presenter completed state with full leaderboard and score percentages
- Phone results page contrast fix (hardcoded accessible colors)

**Next (Phase 5):**
1. Billing integration (invoice/EFT - no Stripe in SA)
2. Additional game modules (Jeopardy, Escape Room, Assessment Scenarios)
3. Production optimizations (Cloud Functions, error handling, offline support)
4. Advanced analytics and reporting

**Known issues:** None currently blocking.

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
