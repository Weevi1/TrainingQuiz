# Lessons — GB Training App

> Patterns learned from corrections. Reviewed at session start.
> Format: `[date] What went wrong → What to do instead`

## Project Role
- [2025-01-27] Codebase deleted and recovered from GitHub → This is v1 reference implementation only. Multi-tenant version is at `/home/aiguy/projects/Traind/`. Use this for reference patterns (session flow, QR, timer sync), not for new features

## Timer
- [Pattern] Timer sync drift → Projector/trainer is authoritative. Update Firestore `currentTimeRemaining` every 1000ms. Clients read from Firestore, not local state
