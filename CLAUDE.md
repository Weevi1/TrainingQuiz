# Trained - Interactive Post-Training Engagement Platform

## Document Management Rules
> **Keep this file under ~200 lines.** When completing work:
> 1. Add a dated entry to `docs/CHANGELOG.md` with details
> 2. Update "Current Status" below if needed
> 3. Do NOT add detailed completion logs here - reference docs/ instead
> 4. The Inbox/Outbox sections are managed by FIFO Ops and should stay here

## Lessons
- Review `lessons.md` at the start of each session
- After any correction from Riaan, record the pattern in `lessons.md`
- Format: `[date] What went wrong → What to do instead`

## Project Overview
Multi-tenant SaaS platform for interactive post-training engagement. Trainers create quizzes, game shows, and activities; participants join via QR code or short URL (`joinsession.xyz`) on mobile.

- **Brand name**: "Trained" (not "Traind") | **Domain**: trained.fifo.systems
- **Business model**: Subscription SaaS (Basic R5k, Professional R14k, Enterprise R35k/year ZAR)
- **Target market**: Corporate trainers, educational institutions, professional development orgs
- **Platform Admin**: riaan.potas@gmail.com (PLATFORM_ADMIN role)
- **Live URL**: https://traind-platform.web.app

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Hosting)
- **Libraries**: React Router, QR Code generation, Lucide icons, jsPDF, html2canvas
- **Email**: Brevo SMTP via Cloud Functions (send from `trained@fifo.systems`)

## Commands
```bash
cd traind-app && npm run dev          # Development server (localhost:5173)
cd traind-app && npm run build        # Production build
cd traind-app && npm install          # Install dependencies
cd functions && npm run build         # Build Cloud Functions
firebase deploy --only hosting        # Deploy BOTH sites (traind-platform + joinsession-xyz)
firebase deploy --only hosting:traind # Deploy main app only
firebase deploy --only hosting:joinsession # Deploy joinsession.xyz only
firebase deploy --only functions      # Deploy Cloud Functions
firebase deploy --only firestore:rules # Deploy Firestore rules
firebase deploy --only storage        # Deploy Storage rules (required for media access)
```

## Deployment Safety
- **This project deploys to**: `traind-platform` (https://traind-platform.web.app) + `joinsession-xyz` (https://joinsession.xyz)
- **Multi-site hosting**: `firebase.json` uses a hosting array with two targets: `traind` (main app) and `joinsession` (short join domain)
- **NEVER deploy to `gb-training`** — that is the v1 app (separate project at `/home/aiguy/projects/gb-training-app/`)
- Always run `firebase deploy` from THIS directory (`/home/aiguy/projects/Traind/`) — the `.firebaserc` targets `traind-platform`
- Never use `--project gb-training` or `firebase use gb-training` in this directory

## Key Architecture Patterns

**Multi-tenant isolation**: All data scoped to `organizations/{orgId}/`. Firestore security rules enforce tenant boundaries. Users have roles (PLATFORM_ADMIN, ORG_OWNER, ORG_ADMIN, TRAINER, PARTICIPANT).

**Quiz published/draft**: Quizzes have a `published?: boolean` field. `isPublished()` helper in `firestore.ts` treats `undefined` as `true` (backwards compat). New quizzes and duplicates default to draft (`false`). QuizManagement splits into "My Quizzes" (own drafts + published, with publish/unpublish toggle) and "Team Quizzes" (other trainers' published quizzes, read-only for trainers). SessionCreator and Dashboard quick-session filter to own + published. Admins (`manage_content` permission) see/edit all. Editing another trainer's quiz preserves the original `trainerId`.

**Theming**: CSS variables set on document root via `BrandingContext.tsx`. 9 presets in `themePresets.ts`. Participant pages use `applyBranding.ts` (no auth context needed). All 46+ components use CSS variables — except elements inside white result cards (ParticipantResults.tsx) which use hardcoded accessible colors to guarantee contrast on any theme. Branding is managed exclusively by the platform admin via `/admin` → Manage → Branding tab (not accessible to tenant admins).

**White-label branding**: Org logo uploaded by superuser in PlatformAdmin → Manage → Branding, auto-resized client-side (`imageResize.ts`: logos 400×200 max, WebP). `BrandingEditor` component (`components/BrandingEditor.tsx`) is a standalone org-agnostic editor (takes `orgId` + `organization` props) with logo, ThemeEditor, reactions, stickers, and interstitial animations. Certificate signer config (name, title, signature) is on the **tenant Settings page** (not BrandingEditor) — appears when "Enable Attendance Certificates" is toggled on. `OrgLogo` component renders logo or monogram fallback. Logo appears in navbar, presenter screens, participant pages, and certificates. **Important**: All branding sub-field updates MUST use Firestore dot notation (`'branding.logo': url`) — never spread the whole branding object (`branding: { ...org.branding, field }`) as this overwrites other fields.

**Participant join flow**: Presenter shows QR code (encodes full `traind-platform.web.app/join/{CODE}` URL) + short domain fallback (`joinsession.xyz` + 2-char code). QR scanners go direct; manual typers go via `joinsession.xyz` which redirects to the main app. `joinsession/index.html` is a standalone static page (Tailwind CDN) hosted on Firebase as a second site (`joinsession-xyz`). Session codes are 2 alphanumeric chars (1,296 combos); `generateSessionCode()` in `firestore.ts` is async and checks active sessions for collisions.

**Quiz snapshot**: When the trainer starts a session, the quiz is snapshotted onto `session.gameData.quizSnapshot` (questions, correct answers, boss multipliers). Session reports and PDFs use this snapshot — never the live quiz document, which may be edited after the session. AdminSessionDetails falls back to the live quiz for pre-snapshot sessions.

**Quiz session flow**:
1. Trainer creates session → QR code + 2-char session code generated
2. Participants scan QR or type `joinsession.xyz` + code → join waiting room (themed)
3. Trainer starts → 3-2-1-GO countdown → quiz active (quiz snapshot saved)
4. **Participants progress independently** through questions (answer → 1.5s feedback → [milestone 2.5s] → [interstitial slide] → [boss intro 3s] → next)
5. **Presenter shows participant progress** (names, scores, progress bars) - NOT the questions
6. Session ends when: all complete, timer expires, or trainer clicks "End"
7. **Animated participant results**: 4-phase reveal — score counter animates (0→actual%), fun facts from individual data, achievement badges pop in, then full results with question breakdown. `showFinalResults()` navigates immediately (no delay). Mutex ref (`showingFinalResultsRef`) prevents double invocation from quiz-end + Firestore subscription race.
8. **Deferred leaderboard**: Personal stats show immediately; leaderboard waits until session `status='completed'` (Firestore subscription). "The results are in!" reveal banner, then full rankings with auto-scroll.
9. Attendance certificate (if enabled by org) — floating download button on results page, proof of attendance, optional CPD points line

**Timer architecture (anchor-based sync + RTDB clock sync)**: All devices subscribe to Firebase RTDB `/.info/serverTimeOffset` on load via `lib/timerSync.ts`, which exports `serverNow()` = `Date.now() + offset`. Presenter writes `timerStartedAt = serverNow()` to Firestore once on start. All devices calculate `remaining = timeLimit - Math.floor((serverNow() - anchor) / 1000)` — no drift, no clock skew. Pause/resume recalculates anchor using `serverNow()`. No per-second Firestore writes. RTDB must be enabled in Firebase console (free tier). Rules in `database.rules.json` lock all reads/writes (only `/.info/serverTimeOffset` is used, which is a client-side feature requiring no rules).

**Sound distribution**: Timer/ambient/lifecycle sounds play ONLY on presenter (SessionControl). Phones get ONLY `correct` and `incorrect` answer feedback. Results page: celebration sounds only for award winners (80%+ score or bingo winners). Join page has no sounds but shows a volume tip message.

**V1 reference**: `/home/aiguy/projects/gb-training-app/frontend/` - original GB Attorneys training app (deployed separately to `gb-training` Firebase project). Key files: `QuizSession.jsx` (presenter), `QuizTaking.jsx` (participant).

**Team invitations**: Admin enters email + role in Settings → Team → writes invitation doc to `organizations/{orgId}/invitations/`. Cloud Function (`onInvitationCreated` in `functions/src/index.ts`) triggers on doc creation, sends Brevo SMTP email with accept link. Recipient visits `/invite/accept?token={uuid}&org={orgId}` → logs in or registers → `joinOrganization()` adds them to the org. Invitation has 7-day expiry, can be revoked. Secrets: `BREVO_SMTP_USER` + `BREVO_SMTP_PASS` in Firebase Secret Manager (same Brevo account as FIFO Ops / Home Digest).

**User→Org index**: `userOrgIndex/{userId}` (env-prefixed) stores `{ orgIds: string[], updatedAt }`. Written by `FirestoreService.createUser()` (when orgId provided) and Cloud Function `handleDirectAdd()`. Read by AuthContext at login — tries index first (1 read), falls back to `findUserInAnyOrganization` (N reads) and backfills the index. Firestore rules: owner read/write only + platform admin read.

**Presenter scaling (PresenterCanvas)**: All presenter screens (lobby, active quiz, results) render inside a 1920×1080 design canvas that scales uniformly via CSS `transform: scale()` to fill any screen (TVs, projectors, monitors). Uses `useViewportScale` hook with ResizeObserver.

## Project Structure
```
functions/src/
└── index.ts         # Cloud Functions: onInvitationCreated (Brevo SMTP email)
traind-app/src/
├── pages/           # Route components (Login, Dashboard, QuizBuilder, SessionControl, PlatformAdmin, AcceptInvite, etc.)
├── contexts/        # AuthContext (multi-tenant auth), BrandingContext (theming)
├── lib/             # firebase.ts, firestore.ts, permissions.ts, themePresets.ts,
│                    # soundSystem.ts, visualEffects.ts, achievementSystem.ts, applyBranding.ts,
│                    # imageResize.ts, storageService.ts, pdfExport.ts, awardCalculator.ts,
│                    # attendanceCertificate.ts, attendanceRegister.ts, mediaConverter.ts, builtInStickers.ts, orgCache.ts,
│                    # timerSync.ts (serverNow() — RTDB clock sync for cross-device timers)
├── hooks/           # useGameTheme.ts, useViewportScale.ts, usePresenterSounds.ts
├── components/      # LoadingSpinner, ProtectedRoute, OrgLogo, AvatarDisplay, ReactionOverlay,
│                    # StickerPicker, MediaUploader, BrandingEditor, ThemeEditor/, gameModules/
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

## Join Session Short Domain
- **File**: `joinsession/index.html` — standalone static page for `joinsession.xyz`
- **Firebase site**: `joinsession-xyz` (target: `joinsession` in `firebase.json`)
- **Behaviour**: Code entry form → redirects to `traind-platform.web.app/join/{CODE}`. Path-based auto-redirect (`joinsession.xyz/A7` → direct redirect).
- **Domain**: `joinsession.xyz` — DNS pointed to Firebase Hosting

## Current Status

**Complete (Phases 1-4):** Multi-tenant platform, 4 game modules with sound/effects/achievements, full theming, participant mobile experience, PDF reports, session flow, anchor-based timer sync, sound distribution (presenter vs phone).

**Recent (February–March 2026):**
- Certificate signer config moved to tenant Settings page (below enable toggle, conditionally shown). Removed from BrandingEditor.
- Fixed branding field overwrite bug: all branding updates now use Firestore dot notation instead of spreading stale objects.
- Dashboard logo fix: was reading from BrandingContext state instead of `currentOrganization?.branding?.logo` directly.
- Demo asset upload script (`scripts/upload-demo-assets.mjs`): converts GIFs → MP4 + WebP thumbnails, uploads to Firebase Storage, updates Firestore. Uses firebase-admin with service account.
- **Participant performance optimizations** (March 2026): Code splitting via `React.lazy()` (participant bundle 1.4 MB, down from 5.2 MB). Org branding cache (`orgCache.ts`) with in-memory + sessionStorage + request deduplication — 1 Firestore read per session instead of 3 per participant. Firebase Storage rules deployed (were never deployed — stickers returned 403).
- **Platform-wide animated stickers** (March 2026): 28 built-in animated avatar stickers (`builtInStickers.ts`) sourced from Google Noto Animated Emoji (Apache 2.0) + 4 original character GIFs. Hosted at `platform/stickers/` in Firebase Storage. DiceBear external API removed entirely — no external avatar dependencies. StickerPicker simplified to single animated grid (no tabs). Org-specific stickers from `branding.stickers` are shown alongside built-ins. Upload script: `scripts/upload-platform-stickers.mjs`.
- **Clock-independent timer sync** (March 2026): Replaced `correctedTimerAnchor` / `timerStartedAtServer` approach with Firebase RTDB `/.info/serverTimeOffset`. All devices use `serverNow()` from `lib/timerSync.ts` for timer anchors and elapsed calculations. Eliminates clock skew between trainer and participant devices entirely. RTDB rules in `database.rules.json`.
- **PDF export overhaul** (March 2026): Session report polished (gradient header, accent bars, color-coded scores, layout constants). CSV attendance replaced with landscape A4 attendance register PDF with org logo. Certificates now download as single merged PDF (one cert per page) instead of individual files. Key files: `pdfExport.ts`, `attendanceRegister.ts`, `attendanceCertificate.ts` (`drawCertificatePage` + `generateMergedCertificatesPDF`).
- **Certificate template system** (March 2026): Org selects template in Settings (`elegant`, `cpd-professional`, `minimal` placeholder). `cpd-professional` matches legal/professional CPD certificates (A&G style): org name + logo header, CERTIFICATE title, form fields with underlines, CPD statement, "signed on behalf of" footer. Org-level: `certificateTemplate`, `companyDescriptor` (subtitle under org name), signature/signer. Session-level: `speaker`, `venue`, `cpdCategory` (on `GameSession`, set in SessionCreator AND Dashboard quick-start modal). `companyDescriptor` is independent of `signerTitle`.
- **Quiz customization features** (March 2026): Three opt-in enhancements configured per quiz in QuizBuilder. (1) **Custom answer feedback** — trainer uploads correct/incorrect videos + audio that replace built-in reactions. (2) **Milestone triggers** — 7 types (streak3/5/10, recovery, halfway, perfectSoFar, almostDone), each with toggle, custom message, optional video+audio; fires once per quiz, higher streaks suppress lower. (3) **Boss questions** — per-question toggle with 2x/3x/5x point multiplier and optional dramatic intro (video+audio). All media preloaded during waiting room. Quiz flow chain: feedback → milestone → interstitial → boss intro → next question.
- **Slide audio layer** (March 2026): After uploading animation to a slide, shows duration and allows adding audio track. `InterstitialOverlay` plays audio layer via `new Audio()`, mutes video when audio present.
- **Cinematic presenter results** (March 2026): `PresenterResultsSummary.tsx` redesigned for projector impact — full-width podium with gradient blocks + glow effects, horizontal awards strip with colored borders, leaderboard rows with score bar backgrounds. Staged reveal: title → podium rises (3rd→2nd→1st with bounce easing) → awards scale in → leaderboard cascades. Auto-adapts row sizing for participant count. Click-to-skip. Everything stays on one screen.
- **Dashboard quick-start certificate fields** (March 2026): When trainer starts a session from Dashboard (quick-start modal) and org has attendance certificates enabled, modal shows Speaker, Venue, and CPD Category fields. Values saved to session doc and flow through to certificate generation — same as SessionCreator's certificate section.
- **QuizBuilder interstitials fix** (March 2026): Deleting a question set `interstitials: undefined` when empty, which Firestore rejects. Fixed to set `[]` instead.
- **Podium ranking fix** (March 2026): Podium and leaderboard table could show different orders because they used separate sort computations (`awardResults.topPerformers` vs `buildLeaderboard`). Fixed: podium now derives from the same `entries` array as the table inside `PresenterResultsSummary`.
- **Firestore cost optimizations** (March 2026): Full cost audit for scale (100s–1000s participants). (1) Removed orphaned `submitAnswer()` call — answers subcollection was written but never read; `gameState.answers` is the real source of truth. (2) Bingo game state debounce increased 2s→5s. (3) Image cache added to `resolveImageToBase64` in `attendanceCertificate.ts`. (4) Participant live-rank subscription replaced with 10s polling (`getSessionParticipants`). (5) `subscribeToOrganizationSessions` now has `limit(100)` + "Load Older Sessions" pagination. (6) New `userOrgIndex/{userId}` collection for O(1) login lookup — replaces expensive all-org scan; backfills on first fallback hit.
- See `docs/CHANGELOG.md` for full history (phases 1-4, presenter redesign, staged reveals, etc.)

**Next (Phase 5):**
1. Billing integration (invoice/EFT - no Stripe in SA)
3. Additional game modules (Jeopardy, Escape Room, Assessment Scenarios)
4. Production optimizations (Cloud Functions, error handling, offline support)

**Known issues:** `certificate.ts` is dead code (kept but unused — achievement certificate removed). Can be deleted.

**Performance architecture**: App uses `React.lazy()` code splitting — participant routes (JoinSession, PlaySession, ParticipantResults) are eagerly loaded; all admin/trainer routes are lazy-loaded into separate chunks. Organization data is cached via `orgCache.ts` (in-memory + sessionStorage, 30-min TTL, request deduplication for concurrent joins). Participant ranking during quiz uses 10s polling (not real-time listener) to avoid N×N Firestore reads. Session management uses `limit(100)` + pagination. Certificate image loading uses module-level cache. The `answers` subcollection (`submitAnswer`) is unused/orphaned — `gameState.answers` on participant docs is the source of truth for all reports. Always deploy `storage.rules` when modifying Firebase Storage security rules (`firebase deploy --only storage`).

**Firebase Storage CORS**: Configured via GCS API (not gsutil). Allows GET from `traind-platform.web.app`, `trained.fifo.systems`, `localhost:5173`. Required for `attendanceCertificate.ts` which uses Firebase Storage SDK `getBlob()` to load logo/signature images into PDFs. If new domains are added, CORS must be updated via the GCS JSON API (see git history for `set-cors.mjs` pattern).

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

### FIFO Comms Policy (2026-02-17)

**Full spec:** `fifo-ops/docs/COMMS_HANDBOOK.md`

Two types of outbound email across FIFO — use these exact terms:

| Term | What | Who sends | How |
|------|------|----------|-----|
| **App Email** | Single-recipient, triggered by a user's action | This app | Brevo SMTP (Cloud Functions), `trained@fifo.systems` |
| **Ops Broadcast** | Multi-recipient, business decision | FIFO Ops | Brevo SMTP, `riaan@fifo.systems`, Riaan approves |

**This app's App Emails (you own these):**
- Team member invitations (implemented — Cloud Function `onInvitationCreated`)
- Session invitations to participants (planned)
- Quiz result summaries to individual participants (planned)
- Password resets, account verification (Firebase Auth built-in)
- Tenant admin notifications (planned)

**Ops Broadcasts (do NOT build — flag via outbox):**
- Feature announcements to all Trained tenants
- Pricing/billing changes, maintenance notices

**To request an Ops Broadcast:** Add `[OPS-BROADCAST]` to outbox with subject, body, and recipients.

### Email Architecture (2026-02-26)
- **Sending**: Brevo SMTP via Cloud Functions (`functions/src/index.ts`). Send from `trained@fifo.systems`. Secrets: `BREVO_SMTP_USER`, `BREVO_SMTP_PASS` in Firebase Secret Manager (same Brevo account as FIFO Ops / Home Digest).
- **Receiving**: Cloudflare Email Routing → Gmail.
- No Google Workspace needed.

### Active Tasks for This Project
- [CRITICAL] Set up ESI Law as a new tenant with legal-professional branding. Presentation-ready before demo.
- [DONE] Fix Interactive Quiz rough edges — all 21 fixed and deployed (2026-02-21)

### Client Context
- **ESI Law** (Jacques): Law firm, new client. In-person training for his attorneys Thursday 27 Feb 08:30. Create tenant via Platform Admin, test full participant flow end-to-end, verify branding on all participant-facing pages.

---

## Outbox for FIFO Ops

<!--
Format: - [DATE] [PROJECT: trained] [PRIORITY: low/medium/high] Description
Items will be processed and removed by FIFO Ops sync.
-->

<!-- All items processed by FIFO Ops on 2026-01-29 -->
<!-- Processed by FIFO Ops on 2026-02-16: Add logo upload to PlatformAdmin "Manage" modal so superuser can upload/manage logos for any tenant without switching to tenant view -->
<!-- Processed by FIFO Ops on 2026-02-21:
- [HIGH] All 21 Interactive Quiz rough edges fixed and deployed. Ready for ESI Law demo 27 Feb.
- [MEDIUM] Bingo verification questions feature shipped (anti-cheating, linked quiz questions on cell tap).
-->
- [2026-02-25] [PROJECT: trained] [PRIORITY: medium] Presenter projector readability overhaul deployed. All text sizes bumped across lobby, active, and results screens for room-scale viewing. Ready for ESI Law demo 27 Feb.
- [2026-02-26] [PROJECT: trained] [PRIORITY: medium] ThemeEditor now live in Settings → Branding. Tenants can self-service full theme customization (presets, colors, fonts, backgrounds) with live preview. Fixed font CSS pipeline bug.
