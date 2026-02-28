# GB Training App - Gustav Barkhuysen Attorneys

## Lessons
- Review `lessons.md` at the start of each session
- After any correction from Riaan, record the pattern in `lessons.md`
- Format: `[date] What went wrong → What to do instead`

## Project Overview
Training Quiz application for GB Attorneys post-training engagement. Allows trainers to create quizzes and participants to join via QR code with real-time results and fun metrics.

**Live URL**: https://gb-training.web.app
**Firebase Project**: gb-training

## Relationship to Traind
This is the **v1 single-tenant implementation** for GB Attorneys. The multi-tenant SaaS version is at `/home/aiguy/projects/Traind/traind-app/` (Trained by FIFO).

**This codebase serves as the reference implementation** for session flow, QR code joining, real-time participant tracking, and timer synchronization. When implementing features in Traind, refer to this codebase for working patterns.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Firebase Firestore + Auth + Real-time
- **Hosting**: Firebase Hosting at https://gb-training.web.app
- **Libraries**: React Router, react-qr-code, Lucide React icons, jsPDF, html2canvas

## Commands
```bash
# Development
cd frontend && npm run dev

# Build
cd frontend && npm run build

# Deploy to Firebase
firebase use gb-training
firebase deploy --only hosting

# Install dependencies
cd frontend && npm install
```

## Project Structure
```
gb-training-app/
├── frontend/               # React application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx              # Landing page
│   │   │   ├── Login.jsx             # Trainer authentication
│   │   │   ├── AdminDashboard.jsx    # Trainer dashboard with quick actions
│   │   │   ├── QuizBuilder.jsx       # Quiz creation/editing
│   │   │   ├── QuizManagement.jsx    # Quiz listing
│   │   │   ├── QuizSession.jsx       # WAITING ROOM - QR code, participant list, timer
│   │   │   ├── QuizTaking.jsx        # Participant quiz experience
│   │   │   ├── Results.jsx           # Participant results
│   │   │   ├── SessionResults.jsx    # Trainer session results view
│   │   │   ├── AdminSessionDetails.jsx # Detailed session analytics
│   │   │   ├── ScratchCard*.jsx      # Scratch card giveaway system (4 files)
│   │   │   └── Auth.jsx              # Authentication
│   │   ├── lib/
│   │   │   ├── firebase.js           # Firebase configuration
│   │   │   ├── firestore.js          # Firestore service functions
│   │   │   ├── gameShowSounds.js     # Sound effects
│   │   │   └── supabase.js           # Legacy (not used)
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx       # Authentication context
│   │   └── App.jsx                   # Main router
│   ├── public/
│   │   ├── gblogo.png                # GB Attorneys logo
│   │   └── gbname.png                # GB Attorneys name logo
│   └── .env                          # Firebase credentials (gb-training project)
└── CLAUDE.md
```

## Key Session Flow (Reference for Traind)

### 1. Start Session (AdminDashboard.jsx)
```javascript
// Click "Start Quiz Session" → Modal opens
const openQuizModal = () => setShowQuizModal(true)

// Select quiz → Click "Start Session"
const startQuizSession = async () => {
  const sessionCode = generateSessionCode()  // 6-char alphanumeric
  const sessionData = await createSession({
    quizId: selectedQuiz.id,
    trainerId: user.uid,
    sessionCode: sessionCode,
    quiz: selectedQuiz  // Embed full quiz data
  })
  navigate(`/admin/session/${sessionData.id}`)
}
```

### 2. Waiting Room (QuizSession.jsx)
- **QR Code**: Points to `${origin}/quiz/${sessionCode}`
- **Real-time participant list**: `subscribeToParticipants(sessionId, callback)`
- **Timer authority**: Projector broadcasts `currentTimeRemaining` to Firestore
- **Session status**: waiting → active → completed

```javascript
// Timer sync - projector is authoritative
const displayTimer = setInterval(async () => {
  const currentTime = calculateTimeRemaining()
  await updateSession(sessionId, {
    currentTimeRemaining: currentTime,
    lastTimerUpdate: Date.now()
  })
}, 1000)
```

### 3. Participant Join (QuizTaking.jsx)
- Enter name → Join session
- Wait for trainer to start
- Answer questions with real-time feedback
- Auto-submit when timer expires

### 4. Key Firestore Functions (lib/firestore.js)
```javascript
createSession(sessionData)           // Create new session
getSession(sessionId)                // Fetch session by ID
updateSession(sessionId, updates)    // Update session status/timer
subscribeToSession(sessionId, cb)    // Real-time session updates
subscribeToParticipants(sessionId, cb)  // Real-time participant list
subscribeToAnswers(sessionId, cb)    // Real-time answer tracking
addParticipant(sessionId, data)      // Add participant to session
generateSessionCode()                // Generate 6-char code
```

## Firebase Configuration
The `.env` file contains Firebase credentials for the `gb-training` project:
```
VITE_FIREBASE_PROJECT_ID=gb-training
VITE_FIREBASE_AUTH_DOMAIN=gb-training.firebaseapp.com
```

## Features
- ✅ Trainer authentication (Firebase Auth)
- ✅ Quiz creation and management
- ✅ Live quiz sessions with QR code joining
- ✅ Real-time participant tracking
- ✅ Synchronized timer (projector is authority)
- ✅ Results with leaderboards and awards
- ✅ Fun metrics: Speed Demon, Perfectionist, Streak Master
- ✅ PDF export for session results
- ✅ Scratch card giveaway system
- ✅ GB Attorneys branding (gold/navy theme)

## Recovery Note (January 27, 2025)
This codebase was recovered from GitHub (Weevi1/TrainingQuiz) and updated with the Firebase version from `/home/aiguy/projects/Traind/frontend/`. The original local folder was accidentally deleted.

The live deployment at https://gb-training.web.app was rolled back to the September 17, 2025 release which contains all the working Firebase implementation.

---

## FIFO Ops Integration

This project reports to **FIFO Ops** (ops.fifo.systems) for centralized task and context tracking across all FIFO Solutions projects.

### Reading from Ops
At session start, check `/home/aiguy/projects/fifo-ops/FIFO_OPS_STATE.md` for current business priorities and cross-project context.

### Writing to Ops
When working in this project, if you identify:
- Tasks that should be tracked in the central Ops dashboard
- Issues requiring Riaan's attention across projects
- Cross-project dependencies or blockers
- Important decisions or context other projects should know about

**Add them to the Outbox section below.** FIFO Ops will process these during its sync.

---

## Inbox from FIFO Ops
> Last updated: 2026-01-29

### FIFO Comms Policy (2026-02-17)

**Full spec:** `fifo-ops/docs/COMMS_HANDBOOK.md`

Two types of outbound email across FIFO — use these exact terms:

| Term | What | Who sends | How |
|------|------|----------|-----|
| **App Email** | Single-recipient, triggered by a user's action | The app | SendGrid |
| **Ops Broadcast** | Multi-recipient, business decision | FIFO Ops | Brevo SMTP, `riaan@fifo.systems`, Riaan approves |

This is a legacy project — no new email features should be built here. All training work happens in **Trained** (`/home/aiguy/projects/Traind`).

### Current Status
Legacy project, superseded by Trained. GB Attorneys conversion to paid Trained client deferred.

---

## Outbox for FIFO Ops

<!--
Add notes for FIFO Ops here. Format:
- [DATE] [PROJECT: gb-training] [PRIORITY: low/medium/high] Description

Example:
- [2026-01-28] [PROJECT: gb-training] [PRIORITY: low] Timer sync issue on slow connections
- [2026-01-28] [PROJECT: gb-training] [PRIORITY: medium] GB requested new feature

Items will be processed and removed by FIFO Ops sync.
-->

