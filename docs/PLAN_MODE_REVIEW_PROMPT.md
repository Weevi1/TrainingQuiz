# Claude Code Plan Mode Review Prompt — Trained

> Paste this into Claude Code when you want a thorough review of a feature or change.

---

Review this plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give me an opinionated recommendation, and ask for my input before assuming a direction.

## My engineering preferences (use these to guide your recommendations):
- DRY is important — flag repetition aggressively.
- This project has zero tests currently. Don't propose adding tests unless I ask. But DO flag code that would be hard to test later.
- I want code that's "engineered enough" — not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity).
- I err on the side of handling more edge cases, not fewer; thoughtfulness > speed.
- Bias toward explicit over clever.
- Keep Firestore reads/writes minimal — every read costs money at scale.

## Project context (always consider these):
- **Stack**: React + Vite + TypeScript + Tailwind CSS + Firebase (Firestore, Auth, Hosting, Storage)
- **Architecture**: Multi-tenant SaaS. All data scoped to `organizations/{orgId}/`. Sessions are top-level (cross-org access for participants).
- **Two user types**: Trainers (authenticated, create quizzes, control sessions) and Participants (unauthenticated, join via QR/code, play on mobile).
- **Presenter screen**: Runs on a TV/projector via `PresenterCanvas` (1920x1080, CSS transform scale). Never show questions — only participant progress.
- **Theming**: CSS variables set on `:root` via `BrandingContext`. Participant pages use `applyBranding.ts` (no auth context). White result cards use hardcoded colors for contrast — never CSS variables inside them.
- **Timer sync**: Anchor-based. Presenter writes `timerStartedAt` once. All devices calculate remaining locally. No per-second Firestore writes.
- **Sound distribution**: Presenter handles all sounds except correct/incorrect (phones only). No sounds on join page.
- **White-label**: Org logo (WebP, max 400x200), `OrgLogo` component with monogram fallback, `--logo-border-radius` CSS variable.

## 1. Architecture review
Evaluate:
- Does this change respect multi-tenant isolation? Will Firestore security rules block cross-tenant access?
- Presenter vs participant responsibility — is logic on the right side?
- Does it add unnecessary Firestore reads/writes? Could it use existing subscriptions?
- Does it work without authentication (participant pages have no auth context)?
- Will it scale on the presenter canvas (1920x1080 fixed, CSS transform)?
- Does it handle the session lifecycle correctly (waiting → countdown → active → completed)?

## 2. Code quality review
Evaluate:
- Does it reuse existing utilities? Check: `firestore.ts`, `soundSystem.ts`, `applyBranding.ts`, `imageResize.ts`, `storageService.ts`, `achievementSystem.ts`, `awardCalculator.ts`.
- Does it follow existing patterns? (e.g., `useCallback` for handlers, refs for values needed in intervals/subscriptions, state for values that trigger re-render)
- DRY violations — be aggressive here.
- Does it respect the white card contrast rule? (hardcoded colors inside `rgba(255,255,255,0.95)` cards, CSS variables elsewhere)
- Error handling: try/catch around Firestore calls, user-facing feedback on failure.
- TypeScript: proper typing, no `any` casts, no missing null checks.

## 3. Firestore & data review
Evaluate:
- N+1 query patterns (e.g., fetching related docs in a loop).
- Missing indexes that will cause Firestore query failures in production.
- Subscription cleanup — every `onSnapshot` must return unsubscribe in `useEffect` cleanup.
- Offline/network-failure behaviour — what happens if Firestore is unreachable?
- Data consistency — if two writes must happen together, are they in a batch/transaction?

## 4. Performance review
Evaluate:
- Bundle impact — the main chunk is already 1.7MB. Will this make it worse? Should it use dynamic `import()`?
- Unnecessary re-renders — are expensive computations in `useMemo`? Are callbacks in `useCallback`?
- Firestore read volume — how many reads per session with 30 participants?
- Timer/interval cleanup — any risk of leaked intervals?

## For each issue you find
For every specific issue (bug, smell, design concern, or risk):
- Describe the problem concretely, with file and line references.
- Present 2-3 options, including "do nothing" where that's reasonable.
- For each option, specify: implementation effort, risk, impact on other code, and maintenance burden.
- Give me your recommended option and why, mapped to my preferences above.
- Then explicitly ask whether I agree or want to choose a different direction before proceeding.

## Workflow and interaction
- Do not assume my priorities on timeline or scale.
- After each section, pause and ask for my feedback before moving on.

## BEFORE YOU START:
Ask if I want one of two options:
1/ **BIG CHANGE**: Work through this interactively, one section at a time (Architecture → Code Quality → Firestore → Performance) with at most 4 top issues in each section.
2/ **SMALL CHANGE**: Work through interactively ONE question per review section.

FOR EACH STAGE OF REVIEW: output the explanation and pros and cons of each stage's questions AND your opinionated recommendation and why, and then use AskUserQuestion. Also NUMBER issues and then give LETTERS for options and when using AskUserQuestion make sure each option clearly labels the issue NUMBER and option LETTER so the user doesn't get confused. Make the recommended option always the 1st option.
