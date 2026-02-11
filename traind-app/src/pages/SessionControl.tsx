import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import QRCode from 'react-qr-code'
import {
  Play, Pause, Square, Users, Clock,
  QrCode, ArrowLeft,
  Zap, Trophy, Target, X, Medal, Star
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type GameSession, type Quiz, type Participant } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { soundSystem } from '../lib/soundSystem'
import { CountdownOverlay } from '../components/CountdownOverlay'
import { calculateSessionAwards, calculateBingoAwards, type Award, type AwardResults } from '../lib/awardCalculator'
import { generateDebugParticipants } from '../lib/debugData'
import { StagedReveal, RevealSlot, type RevealPhase } from '../components/presenter/StagedReveal'
import ResultsPodium from '../components/presenter/ResultsPodium'
import AwardsCeremony from '../components/presenter/AwardsCeremony'
import { PresenterLeaderboard } from '../components/presenter/PresenterLeaderboard'
import { PresenterStats } from '../components/presenter/PresenterStats'
import { PresenterCanvas } from '../components/presenter/PresenterCanvas'
import { usePresenterSounds } from '../hooks/usePresenterSounds'

type SessionStatus = 'waiting' | 'active' | 'paused' | 'completed'

interface SessionStats {
  totalParticipants: number
  averageScore: number
  completionRate: number
  averageTime: number
  completedCount: number
}

export const SessionControl: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user, currentOrganization, hasPermission } = useAuth()
  const isMuted = (location.state as any)?.muteSound === true

  // Debug mode: /debug/results or ?debug=true on any session URL
  const searchParams = new URLSearchParams(location.search)
  const isDebugMode = searchParams.get('debug') === 'true' || location.pathname === '/debug/results'

  // Pre-compute debug data so initial state is populated (no flash of "not found")
  const debugData = useMemo(() => isDebugMode ? generateDebugParticipants(15) : null, [isDebugMode])

  const [session, setSession] = useState<GameSession | null>(debugData?.session ?? null)
  const [quiz, setQuiz] = useState<Quiz | null>(debugData?.quiz ?? null)
  const [participants, setParticipants] = useState<Participant[]>(debugData?.participants ?? [])
  const [sessionStats, setSessionStats] = useState<SessionStats>(() => {
    if (!debugData) return { totalParticipants: 0, averageScore: 0, completionRate: 0, averageTime: 0, completedCount: 0 }
    const p = debugData.participants
    const totalScores = p.reduce((sum, pp) => sum + (pp.gameState?.score || 0), 0)
    const completed = p.filter(pp => pp.completed)
    const allAnswers = p.flatMap(pp => pp.gameState?.answers || [])
    const avgTime = allAnswers.length > 0 ? allAnswers.reduce((sum, a) => sum + a.timeSpent, 0) / allAnswers.length : 0
    return {
      totalParticipants: p.length,
      averageScore: Math.round(totalScores / p.length),
      completionRate: Math.round((completed.length / p.length) * 100),
      averageTime: Math.round(avgTime),
      completedCount: completed.length,
    }
  })

  const [timeRemaining, setTimeRemaining] = useState(30)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const timerStartedAtRef = useRef<number>(0)       // Anchor: Date.now() when timer started
  const sessionTimeLimitRef = useRef<number>(300)    // Total session time in seconds
  const [loading, setLoading] = useState(!isDebugMode)
  const [showQRCode, setShowQRCode] = useState(false)
  const [showFullscreenQR, setShowFullscreenQR] = useState(false)
  const [participantCountAnimating, setParticipantCountAnimating] = useState(false)
  const [qrSize, setQrSize] = useState(180)
  const previousParticipantCount = useRef(0)

  // Ref for quiz — used by updateSessionStats to avoid stale closures in onSnapshot callback
  const quizRef = useRef<Quiz | null>(quiz)
  useEffect(() => { quizRef.current = quiz }, [quiz])

  // Detect if this is a bingo session
  const isBingoSession = session?.gameType === 'bingo'

  // Timeout fallback: if results data hasn't arrived after 10s, show whatever we have
  const [resultsTimedOut, setResultsTimedOut] = useState(false)
  useEffect(() => {
    if (session?.status !== 'completed') {
      setResultsTimedOut(false)
      return
    }
    const timeout = setTimeout(() => setResultsTimedOut(true), 10000)
    return () => clearTimeout(timeout)
  }, [session?.status])

  const [revealPhase, setRevealPhase] = useState<RevealPhase>('splash')
  const [debugRevealKey, setDebugRevealKey] = useState(0)

  // Check if participant results data has fully propagated to Firestore
  // After session completes, gameState.answers may arrive slightly after the completed flag
  const dataFullyLoaded = useMemo(() => {
    if (session?.status !== 'completed') return false
    if (participants.length === 0) return true

    // For bingo sessions, check for bingo-specific game state
    if (isBingoSession) {
      return participants.every(p =>
        p.gameState && (p.gameState.gameWon !== undefined || p.gameState.cellsMarked !== undefined)
      )
    }

    // For quiz sessions, check that completed participants have their answers populated
    const completedParticipants = participants.filter(p => p.completed || p.gameState?.completed)
    if (completedParticipants.length === 0) return true

    return completedParticipants.every(p => {
      const answers = p.gameState?.answers
      return (answers && answers.length > 0) || (p.gameState?.score && p.gameState.score > 0) || (p.finalScore && p.finalScore > 0)
    })
  }, [session?.status, participants, isBingoSession])

  // Results are ready when data has loaded OR the timeout has elapsed
  const resultsReady = dataFullyLoaded || resultsTimedOut

  // Calculate awards when session is completed AND data is ready
  const awardResults = useMemo<AwardResults>(() => {
    if (session?.status !== 'completed' || !resultsReady) {
      return { awards: [], topPerformers: [] }
    }
    if (isBingoSession) {
      return calculateBingoAwards(participants)
    }
    if (!quiz) {
      return { awards: [], topPerformers: [] }
    }
    return calculateSessionAwards(participants, quiz.questions.length)
  }, [session?.status, participants, quiz, isBingoSession, resultsReady])

  // Presenter celebration sounds synced with staged reveal phases
  usePresenterSounds(revealPhase, {
    enabled: !isMuted && session?.status === 'completed' && resultsReady,
    awardsCount: awardResults.awards.length
  })

  // Helper function to get award icon component
  const getAwardIcon = (iconType: string, size: number = 20) => {
    const iconProps = { size }
    switch (iconType) {
      case 'trophy': return <Trophy {...iconProps} />
      case 'zap': return <Zap {...iconProps} />
      case 'clock': return <Clock {...iconProps} />
      case 'target': return <Target {...iconProps} />
      case 'star': return <Star {...iconProps} />
      case 'medal': return <Medal {...iconProps} />
      default: return <Trophy {...iconProps} />
    }
  }

  // Responsive QR code sizing
  useEffect(() => {
    const updateQrSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const maxSize = Math.min(width * 0.25, height * 0.3, 220)
      const minSize = 140
      setQrSize(Math.max(minSize, maxSize))
    }

    updateQrSize()
    window.addEventListener('resize', updateQrSize)
    return () => window.removeEventListener('resize', updateQrSize)
  }, [])

  // Mute sounds on the trainer's window (projector popup plays sounds)
  useEffect(() => {
    if (isMuted) {
      soundSystem.setEnabled(false)
    }
    return () => {
      soundSystem.setEnabled(true)
    }
  }, [isMuted])

  // Check permissions (skip in debug mode)
  useEffect(() => {
    if (isDebugMode) return
    if (!hasPermission('create_sessions')) {
      navigate('/dashboard')
      return
    }
  }, [hasPermission, navigate, isDebugMode])

  // Load session data (initial fetch for quiz + timer setup)
  useEffect(() => {
    if (isDebugMode) return
    if (sessionId) {
      loadSession()
    }
  }, [sessionId, isDebugMode])

  // Real-time session subscription (syncs status/timer across windows)
  useEffect(() => {
    if (isDebugMode) return
    if (!sessionId || loading) return

    const unsubscribe = FirestoreService.subscribeToSession(sessionId, (updatedSession) => {
      if (!updatedSession) return

      setSession(updatedSession)

      // Sync timer state from Firestore when session becomes active
      if (updatedSession.status === 'active' && updatedSession.timerStartedAt) {
        timerStartedAtRef.current = updatedSession.timerStartedAt
        if (updatedSession.sessionTimeLimit) {
          sessionTimeLimitRef.current = updatedSession.sessionTimeLimit
        }

        if (updatedSession.timerPaused) {
          setIsTimerRunning(false)
          setTimeRemaining(updatedSession.pausedTimeRemaining || sessionTimeLimitRef.current)
        } else {
          const elapsed = Math.floor((Date.now() - updatedSession.timerStartedAt) / 1000)
          const remaining = Math.max(0, sessionTimeLimitRef.current - elapsed)
          setTimeRemaining(remaining)
          if (remaining > 0) {
            setIsTimerRunning(true)
          }
        }
      } else if (updatedSession.status === 'completed') {
        setIsTimerRunning(false)
      }
    })

    return unsubscribe
  }, [sessionId, loading])

  // Real-time participants subscription
  useEffect(() => {
    if (isDebugMode) return
    if (!sessionId) return

    const unsubscribe = FirestoreService.subscribeToSessionParticipants(
      sessionId,
      (newParticipants) => {
        // Check if a new participant joined
        if (newParticipants.length > previousParticipantCount.current) {
          // Play friendly join sound
          soundSystem.play('participantJoin')
          // Trigger count animation
          setParticipantCountAnimating(true)
          setTimeout(() => setParticipantCountAnimating(false), 600)
        }
        previousParticipantCount.current = newParticipants.length
        setParticipants(newParticipants)
        updateSessionStats(newParticipants)
      }
    )

    return unsubscribe
  }, [sessionId])

  // Recalculate stats when quiz loads (fixes stale completion data from before quiz was available)
  useEffect(() => {
    if (quiz && participants.length > 0) {
      updateSessionStats(participants)
    }
  }, [quiz])

  // Timer logic - anchor-based calculation (prevents drift, syncs with participants)
  // Instead of decrementing, we calculate: remaining = timeLimit - elapsed
  useEffect(() => {
    if (isTimerRunning && session?.status === 'active' && timerStartedAtRef.current > 0) {
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerStartedAtRef.current) / 1000)
        const remaining = Math.max(0, sessionTimeLimitRef.current - elapsed)

        setTimeRemaining(prev => {
          // Timer sounds on presenter only (phones are quiet)
          if (remaining > 0 && remaining <= 10 && prev > remaining) {
            soundSystem.play('timeWarning')
          } else if (remaining > 10 && remaining <= 30 && prev > remaining) {
            soundSystem.play('tick')
          }

          if (remaining <= 0 && prev > 0) {
            setIsTimerRunning(false)
            completeSession()
          }

          return remaining
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [isTimerRunning, session?.status])

  // Auto-end session when all participants complete the quiz
  useEffect(() => {
    if (session?.status !== 'active' || participants.length === 0 || isBingoSession) return

    const allCompleted = participants.every(p =>
      p.completed || p.gameState?.completed ||
      (p.gameState?.answers?.length || 0) >= (quiz?.questions.length || Infinity)
    )

    if (allCompleted && quiz) {
      // Brief delay before auto-ending to let final scores update
      const timer = setTimeout(() => {
        completeSession()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [participants, session?.status, quiz, isBingoSession])

  const loadSession = async () => {
    if (!sessionId) return

    setLoading(true)
    try {
      // Fetch real session from Firestore
      const realSession = await FirestoreService.getSession(sessionId)

      if (!realSession) {
        console.error('Session not found:', sessionId)
        alert('Session not found')
        navigate('/dashboard')
        return
      }

      // Fetch real quiz from Firestore
      const quizId = realSession.gameData?.quizId
      if (!quizId) {
        // Bingo sessions may not require a quiz
        if (realSession.gameType === 'bingo') {
          setSession(realSession)
          const bingoTimeLimit = realSession.settings?.timeLimit || 900
          sessionTimeLimitRef.current = bingoTimeLimit

          if (realSession.status === 'active' && realSession.timerStartedAt) {
            timerStartedAtRef.current = realSession.timerStartedAt
            if (realSession.timerPaused) {
              setTimeRemaining(realSession.pausedTimeRemaining || bingoTimeLimit)
            } else {
              const elapsed = Math.floor((Date.now() - realSession.timerStartedAt) / 1000)
              const remaining = Math.max(0, bingoTimeLimit - elapsed)
              setTimeRemaining(remaining)
              if (remaining > 0) setIsTimerRunning(true)
            }
          } else {
            setTimeRemaining(bingoTimeLimit)
          }
          return
        }
        console.error('No quiz ID found in session')
        alert('Session has no associated quiz')
        navigate('/dashboard')
        return
      }

      const realQuiz = await FirestoreService.getQuiz(realSession.organizationId, quizId)

      if (!realQuiz) {
        console.error('Quiz not found:', quizId)
        alert('Quiz not found')
        navigate('/dashboard')
        return
      }

      setSession(realSession)
      setQuiz(realQuiz)

      // Restore timer from Firestore anchor (handles page refresh during active session)
      const totalTimeLimit = realSession.gameType === 'bingo'
        ? (realSession.settings?.timeLimit || 900)
        : realQuiz.timeLimit * realQuiz.questions.length

      sessionTimeLimitRef.current = totalTimeLimit

      if (realSession.status === 'active' && realSession.timerStartedAt) {
        // Active session with anchor - calculate remaining from anchor
        timerStartedAtRef.current = realSession.timerStartedAt

        if (realSession.timerPaused) {
          // Timer was paused - show paused remaining time
          setTimeRemaining(realSession.pausedTimeRemaining || totalTimeLimit)
        } else {
          // Timer is running - calculate current remaining and resume
          const elapsed = Math.floor((Date.now() - realSession.timerStartedAt) / 1000)
          const remaining = Math.max(0, totalTimeLimit - elapsed)
          setTimeRemaining(remaining)
          if (remaining > 0) {
            setIsTimerRunning(true)
          }
        }
      } else {
        // Session not yet started - show full time
        setTimeRemaining(totalTimeLimit)
      }

    } catch (error) {
      console.error('Error loading session:', error)
      alert('Error loading session')
    } finally {
      setLoading(false)
    }
  }

  const updateSessionStats = (participants: Participant[]) => {
    if (participants.length === 0) {
      setSessionStats({
        totalParticipants: 0,
        averageScore: 0,
        completionRate: 0,
        averageTime: 0,
        completedCount: 0
      })
      return
    }

    const participantsWithGameState = participants.filter(p => p.gameState)
    // Use gameState.score, falling back to finalScore (written by markParticipantCompleted)
    const totalScores = participantsWithGameState.reduce((sum, p) =>
      sum + (p.gameState?.score || p.finalScore || 0), 0)
    const averageScore = participantsWithGameState.length > 0 ? totalScores / participantsWithGameState.length : 0

    // Completion detection differs by game type
    // Use quizRef to avoid stale closure (this runs inside onSnapshot callback)
    const currentQuiz = quizRef.current
    const completedParticipants = participants.filter(p => {
      if (p.completed || p.gameState?.completed) return true
      if (isBingoSession) {
        return p.gameState?.gameWon || p.gameState?.fullCardAchieved
      }
      // Use Infinity fallback: if quiz not yet loaded, no one is "completed"
      return (p.gameState?.answers?.length || 0) >= (currentQuiz?.questions.length || Infinity)
    })
    const completionRate = participants.length > 0 ? (completedParticipants.length / participants.length) * 100 : 0

    // Average time differs by game type
    let averageTime = 0
    if (isBingoSession) {
      const timesSpent = participantsWithGameState.filter(p => p.gameState?.timeSpent).map(p => p.gameState!.timeSpent!)
      averageTime = timesSpent.length > 0
        ? timesSpent.reduce((sum, t) => sum + t, 0) / timesSpent.length
        : 0
    } else {
      const allAnswers = participantsWithGameState.flatMap(p => p.gameState?.answers || [])
      averageTime = allAnswers.length > 0
        ? allAnswers.reduce((sum, answer) => sum + answer.timeSpent, 0) / allAnswers.length
        : 0
    }

    setSessionStats({
      totalParticipants: participants.length,
      averageScore: Math.round(averageScore),
      completionRate: Math.round(completionRate),
      averageTime: Math.round(averageTime),
      completedCount: completedParticipants.length
    })
  }

  // Kick participant function
  const kickParticipant = async (participantId: string, participantName: string) => {
    if (!sessionId) return

    const confirmed = confirm(`Are you sure you want to remove ${participantName} from the session?`)
    if (!confirmed) return

    try {
      await FirestoreService.removeParticipant(sessionId, participantId)
      soundSystem.play('whoosh')
    } catch (error) {
      console.error('Error removing participant:', error)
      alert('Failed to remove participant')
    }
  }

  const startSession = async () => {
    if (!session) return

    try {
      // Play countdown sounds on presenter (training room speakers)
      // 0s: tick (3), 1s: tick (2), 2s: tick (1), 3s: gameStart (GO!)
      soundSystem.play('tick')
      setTimeout(() => soundSystem.play('tick'), 1000)
      setTimeout(() => soundSystem.play('tick'), 2000)
      setTimeout(() => soundSystem.play('gameStart'), 3000)

      // First, set status to 'countdown' to trigger countdown on participant devices
      await FirestoreService.updateSession(session.id, {
        status: 'countdown'
      })

      setSession(prev => prev ? { ...prev, status: 'countdown' } : null)

      // After 4 seconds (3-2-1-GO!), set to active with timer anchor
      setTimeout(async () => {
        try {
          const timerStart = Date.now()
          const totalTimeLimit = isBingoSession
            ? (session.settings?.timeLimit || 900)
            : (quiz ? quiz.timeLimit * quiz.questions.length : 300)

          // Store anchor in refs for local calculation
          timerStartedAtRef.current = timerStart
          sessionTimeLimitRef.current = totalTimeLimit

          // Write anchor to Firestore so all devices can sync
          await FirestoreService.updateSession(session.id, {
            status: 'active',
            startTime: new Date(),
            timerStartedAt: timerStart,
            sessionTimeLimit: totalTimeLimit,
            timerPaused: false
          })

          setSession(prev => prev ? { ...prev, status: 'active' } : null)
          setTimeRemaining(totalTimeLimit)
          setIsTimerRunning(true)
        } catch (error) {
          console.error('Error activating session:', error)
        }
      }, 4000)
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Error starting session')
    }
  }

  const pauseSession = async () => {
    setIsTimerRunning(false)
    const remaining = timeRemaining

    // Write paused state so participants know
    if (session) {
      try {
        await FirestoreService.updateSession(session.id, {
          timerPaused: true,
          pausedTimeRemaining: remaining
        })
      } catch (error) {
        console.error('Error syncing pause:', error)
      }
    }
  }

  const resumeSession = async () => {
    // Recalculate anchor: pretend timer started (sessionTimeLimit - remaining) seconds ago
    const remaining = timeRemaining
    const newAnchor = Date.now() - (sessionTimeLimitRef.current - remaining) * 1000
    timerStartedAtRef.current = newAnchor
    setIsTimerRunning(true)

    // Write new anchor so participants stay in sync
    if (session) {
      try {
        await FirestoreService.updateSession(session.id, {
          timerStartedAt: newAnchor,
          timerPaused: false
        })
      } catch (error) {
        console.error('Error syncing resume:', error)
      }
    }
  }

  const completeSession = async () => {
    if (!session || session.status === 'completed') return

    try {
      await FirestoreService.updateSession(session.id, {
        status: 'completed',
        endTime: new Date()
      })

      setSession(prev => prev ? { ...prev, status: 'completed' } : null)
      setIsTimerRunning(false)

      // Play completion sound (like v1's playQuizComplete)
      soundSystem.play('fanfare')
      setTimeout(() => soundSystem.play('celebration'), 500)
    } catch (error) {
      console.error('Error ending session:', error)
    }
  }

  const endSession = async () => {
    if (!session) return

    if (!confirm('Are you sure you want to end this session? This action cannot be undone.')) {
      return
    }

    await completeSession()
  }

  const resetTimer = async () => {
    const totalTimeLimit = isBingoSession
      ? (session?.settings?.timeLimit || 900)
      : (quiz ? quiz.timeLimit * quiz.questions.length : 300)

    const newAnchor = Date.now()
    timerStartedAtRef.current = newAnchor
    sessionTimeLimitRef.current = totalTimeLimit
    setTimeRemaining(totalTimeLimit)
    setIsTimerRunning(false)

    // Write reset anchor to Firestore
    if (session) {
      try {
        await FirestoreService.updateSession(session.id, {
          timerStartedAt: newAnchor,
          sessionTimeLimit: totalTimeLimit,
          timerPaused: true,
          pausedTimeRemaining: totalTimeLimit
        })
      } catch (error) {
        console.error('Error syncing timer reset:', error)
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Convert raw score (100 per correct answer) to percentage string
  const scoreToPercentage = (rawScore: number | string): string => {
    if (typeof rawScore === 'string') return rawScore
    if (!quiz || quiz.questions.length === 0) return `${rawScore}`
    return `${Math.round((rawScore / (quiz.questions.length * 100)) * 100)}%`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!session || (!quiz && session?.gameType !== 'bingo')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Session not found</p>
          <button
            onClick={() => navigate('/sessions')}
            className="btn-primary"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    )
  }

  const sessionUrl = `${window.location.origin}/join/${session.code}`

  return (
    <>
    {/* Countdown overlay on presenter screen (3-2-1-GO!) */}
    {session?.status === 'countdown' && (
      <CountdownOverlay
        onComplete={() => {}}
        startFrom={3}
        sessionTitle={session.title}
      />
    )}

    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/sessions')}
                className="p-2 text-text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-primary">{session.title}</h1>
                <p className="text-sm text-text-secondary">Session Code: {session.code}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowQRCode(!showQRCode)}
                className="btn-secondary flex items-center space-x-2"
              >
                <QrCode size={16} />
                <span>QR Code</span>
              </button>

              <div className="flex items-center space-x-2">
                {session.status === 'waiting' && (
                  <button
                    onClick={startSession}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Play size={16} />
                    <span>Start Session</span>
                  </button>
                )}

                {session.status === 'active' && (
                  <>
                    <button
                      onClick={isTimerRunning ? pauseSession : resumeSession}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
                      <span>{isTimerRunning ? 'Pause' : 'Resume'}</span>
                    </button>
                    <button
                      onClick={endSession}
                      className="btn-danger flex items-center space-x-2"
                    >
                      <Square size={16} />
                      <span>End Session</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div
        className="overflow-hidden relative"
        style={{ height: 'calc(100vh - 4rem)' }}
      >
        <PresenterCanvas>
            {/* WAITING STATE: Full-width lobby for projector */}
            {session.status === 'waiting' && (
              <div className="h-full flex flex-col p-10">
                {/* Session title */}
                <div className="text-center mb-6">
                  <h1 className="text-5xl font-bold" style={{ color: 'var(--text-color)' }}>
                    {session.title}
                  </h1>
                </div>

                {/* Main: QR hero + Participants */}
                <div className="flex-1 flex gap-12 min-h-0">
                  {/* Left: QR Code hero */}
                  <div className="flex flex-col items-center justify-center" style={{ width: '40%' }}>
                    <div className="text-2xl font-medium mb-5" style={{ color: 'var(--text-secondary-color)' }}>
                      Scan to join
                    </div>
                    <div className="p-5 rounded-2xl bg-white shadow-lg">
                      <QRCode value={sessionUrl} size={320} level="M" />
                    </div>
                    <div className="mt-5 text-center">
                      <div className="text-lg break-all" style={{ color: 'var(--text-secondary-color)', opacity: 0.7 }}>
                        {sessionUrl}
                      </div>
                    </div>
                  </div>

                  {/* Right: Participants */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--primary-color)' }}>
                          <Users size={28} style={{ color: 'var(--text-on-primary-color, white)' }} />
                        </div>
                        <h2 className="text-3xl font-bold" style={{ color: 'var(--text-color)' }}>
                          Participants
                        </h2>
                      </div>
                      <div
                        className={`px-5 py-2 rounded-full text-2xl font-bold transition-all duration-300 ${
                          participantCountAnimating ? 'scale-110' : ''
                        }`}
                        style={{
                          backgroundColor: 'var(--primary-color)',
                          color: 'var(--text-on-primary-color, white)'
                        }}
                      >
                        {participants.length}
                      </div>
                    </div>

                    {participants.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center" style={{ opacity: 0.5 }}>
                        <Users size={80} style={{ color: 'var(--text-secondary-color)' }} />
                        <p className="text-2xl mt-6" style={{ color: 'var(--text-secondary-color)' }}>
                          Waiting for participants...
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto">
                        <div className="grid grid-cols-3 gap-3">
                          {participants.map((participant) => (
                            <div
                              key={participant.id}
                              className="flex items-center gap-3 p-4 rounded-xl group"
                              style={{
                                backgroundColor: 'var(--surface-color)',
                                animation: 'fadeIn 0.3s ease-out'
                              }}
                            >
                              <div className="relative flex-shrink-0">
                                <div
                                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                                  style={{ backgroundColor: 'var(--primary-light-color)' }}
                                >
                                  {(participant as any).avatar || '\u{1F600}'}
                                </div>
                                <div
                                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2"
                                  style={{
                                    backgroundColor: 'var(--success-color, #22c55e)',
                                    borderColor: 'var(--surface-color)'
                                  }}
                                />
                              </div>
                              <span className="text-xl font-medium truncate" style={{ color: 'var(--text-color)' }}>
                                {participant.name}
                              </span>
                              <button
                                onClick={() => kickParticipant(participant.id, participant.name)}
                                className="opacity-0 group-hover:opacity-100 ml-auto p-1 rounded transition-all"
                                style={{ color: 'var(--error-color, #ef4444)' }}
                                title={`Remove ${participant.name}`}
                              >
                                <X size={20} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom info strip */}
                <div
                  className="flex items-center justify-center gap-8 mt-5 py-4 rounded-xl"
                  style={{ backgroundColor: 'var(--surface-color)' }}
                >
                  {isBingoSession ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-xl" style={{ color: 'var(--text-secondary-color)' }}>Card Size</span>
                        <span className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>5x5</span>
                      </div>
                      <div className="w-px h-8" style={{ backgroundColor: 'var(--border-color)' }} />
                      <div className="flex items-center gap-3">
                        <span className="text-xl" style={{ color: 'var(--text-secondary-color)' }}>Win</span>
                        <span className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>Line</span>
                      </div>
                      <div className="w-px h-8" style={{ backgroundColor: 'var(--border-color)' }} />
                      <div className="flex items-center gap-3">
                        <Clock size={24} style={{ color: 'var(--text-secondary-color)' }} />
                        <span className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>
                          {formatTime(session.settings?.timeLimit || 900)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-xl" style={{ color: 'var(--text-secondary-color)' }}>Questions</span>
                        <span className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{quiz.questions.length}</span>
                      </div>
                      <div className="w-px h-8" style={{ backgroundColor: 'var(--border-color)' }} />
                      <div className="flex items-center gap-3">
                        <span className="text-xl" style={{ color: 'var(--text-secondary-color)' }}>Per Question</span>
                        <span className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{quiz.timeLimit}s</span>
                      </div>
                      <div className="w-px h-8" style={{ backgroundColor: 'var(--border-color)' }} />
                      <div className="flex items-center gap-3">
                        <Clock size={24} style={{ color: 'var(--text-secondary-color)' }} />
                        <span className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>
                          {formatTime(quiz.timeLimit * quiz.questions.length)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* COMPLETED STATE: Show results and awards */}
            {session.status === 'completed' && (
              <div className="flex flex-col h-full">
                {/* Waiting for results data to propagate */}
                {!resultsReady && (
                  <div className="card mb-6">
                    <div className="flex flex-col items-center justify-center py-12">
                      <LoadingSpinner size="lg" />
                      <h3 className="text-lg font-semibold mt-4" style={{ color: 'var(--text-color)' }}>
                        Finalising Results...
                      </h3>
                      <p className="text-sm mt-2" style={{ color: 'var(--text-secondary-color)' }}>
                        Waiting for all participant scores to sync
                      </p>
                    </div>
                  </div>
                )}

                {/* Results content — scaled canvas fills any screen */}
                {resultsReady && (
                    <StagedReveal
                      key={debugRevealKey}
                      enabled={resultsReady}
                      onPhaseChange={(phase) => setRevealPhase(phase)}
                      awardsCount={awardResults.awards.length}
                    >
                      {/* Slide 1: Splash — fills available space, centered */}
                      <RevealSlot phase="splash" className="flex-1 flex">
                        <div className="flex flex-col items-center justify-center flex-1">
                          <Trophy size={80} style={{ color: 'var(--gold-color, #fbbf24)' }} />
                          <h1 className="text-6xl font-bold mt-8" style={{ color: 'var(--text-color)' }}>
                            Session Complete!
                          </h1>
                          <p className="text-2xl mt-4" style={{ color: 'var(--text-secondary-color)' }}>
                            {participants.length} participant{participants.length !== 1 ? 's' : ''} competed
                          </p>
                        </div>
                      </RevealSlot>

                      {/* Slide 2: Podium — fills available space, centered */}
                      <RevealSlot phase="podium" className="flex-1 flex">
                        {awardResults.topPerformers.length > 0 && (
                          <div className="flex flex-col items-center justify-center flex-1">
                            <ResultsPodium
                              topPerformers={awardResults.topPerformers}
                              scoreFormatter={scoreToPercentage}
                              animate={true}
                            />
                          </div>
                        )}
                      </RevealSlot>

                      {/* Slide 3: Awards — fills available space */}
                      <RevealSlot phase="awards" className="flex-1 flex">
                        {awardResults.awards.length > 0 && (
                          <div className="flex flex-col justify-center flex-1 px-8">
                            <AwardsCeremony
                              awards={awardResults.awards}
                              animate={true}
                              getAwardIcon={getAwardIcon}
                            />
                          </div>
                        )}
                      </RevealSlot>

                      {/* Slide 4 (final): Leaderboard + Stats combined — stays on screen */}
                      <RevealSlot phase="leaderboard" className="flex-1 flex flex-col">
                        <div className="card flex-1 mx-8">
                          <PresenterLeaderboard
                            participants={participants}
                            quiz={quiz}
                            isBingoSession={isBingoSession}
                          />
                        </div>
                      </RevealSlot>

                      <RevealSlot phase="stats">
                        <div className="mx-8">
                          <PresenterStats
                            stats={sessionStats}
                            isBingoSession={isBingoSession}
                            bingoWinners={participants.filter(p => p.gameState?.gameWon).length}
                            scoreFormatter={scoreToPercentage}
                            timeFormatter={(seconds) => isBingoSession ? formatTime(seconds) : `${seconds}s`}
                          />
                        </div>
                      </RevealSlot>
                    </StagedReveal>
                )}
              </div>
            )}

            {/* ACTIVE STATE: Full-width progress view */}
            {session.status === 'active' && (
              <div className="h-full flex flex-col p-10">
                {/* Timer hero */}
                <div className="text-center mb-4">
                  <div
                    className={`text-8xl font-mono font-bold tabular-nums ${timeRemaining <= 60 ? 'animate-pulse' : ''}`}
                    style={{
                      color: timeRemaining <= 60 ? 'var(--error-color)' :
                        timeRemaining <= 120 ? 'var(--warning-color, #eab308)' :
                        'var(--primary-color)'
                    }}
                  >
                    {formatTime(timeRemaining)}
                  </div>
                  <div className="w-full mt-3 rounded-full h-3" style={{ backgroundColor: 'var(--border-color)' }}>
                    <div
                      className="h-3 rounded-full transition-all duration-1000"
                      style={{
                        width: `${(timeRemaining / (isBingoSession
                          ? (session.settings?.timeLimit || 900)
                          : (quiz.timeLimit * quiz.questions.length)
                        )) * 100}%`,
                        backgroundColor: timeRemaining <= 60 ? 'var(--error-color)' :
                          timeRemaining <= 120 ? 'var(--warning-color, #eab308)' :
                          'var(--primary-color)'
                      }}
                    />
                  </div>
                </div>

                {/* Participant progress */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="space-y-3">
                    {(isBingoSession
                      ? participants
                      : participants.slice().sort((a, b) => (b.gameState?.score || 0) - (a.gameState?.score || 0))
                    ).map((participant, index) => {
                      const gs = participant.gameState
                      // Bingo metrics
                      const cellsMarked = gs?.cellsMarked || 0
                      const totalCells = gs?.totalCells || 25
                      const hasWon = gs?.gameWon || false
                      const linesCompleted = gs?.linesCompleted || 0
                      // Quiz metrics
                      const answeredCount = gs?.answers?.length || 0
                      const totalQ = quiz?.questions.length || 1
                      // Unified
                      const progress = isBingoSession
                        ? (totalCells > 0 ? (cellsMarked / totalCells) * 100 : 0)
                        : (totalQ > 0 ? (answeredCount / totalQ) * 100 : 0)
                      const isCompleted = isBingoSession
                        ? hasWon
                        : (participant.completed || gs?.completed || answeredCount >= totalQ)
                      const score = gs?.score || 0

                      return (
                        <div
                          key={participant.id}
                          className="flex items-center gap-4 px-5 py-3 rounded-xl"
                          style={{
                            backgroundColor: isCompleted
                              ? isBingoSession ? 'rgba(251, 191, 36, 0.15)' : 'var(--success-light-color, #dcfce7)'
                              : 'var(--surface-color)'
                          }}
                        >
                          {/* Rank (quiz only) */}
                          {!isBingoSession && (
                            <div className="w-10 text-center text-2xl font-bold tabular-nums" style={{ color: 'var(--text-secondary-color)' }}>
                              {index + 1}
                            </div>
                          )}
                          {/* Avatar */}
                          <span className="text-3xl flex-shrink-0">{(participant as any).avatar || '\u{1F600}'}</span>
                          {/* Name */}
                          <span className="text-2xl font-medium truncate" style={{ color: 'var(--text-color)', minWidth: 180 }}>
                            {participant.name}
                          </span>
                          {/* Status badge */}
                          {isCompleted && !isBingoSession && (
                            <span className="px-3 py-1 rounded-full text-sm font-bold flex-shrink-0" style={{ backgroundColor: 'var(--success-color)', color: 'white' }}>
                              DONE
                            </span>
                          )}
                          {hasWon && isBingoSession && (
                            <span className="px-3 py-1 rounded-full text-sm font-bold flex-shrink-0" style={{ backgroundColor: 'var(--gold-color, #fbbf24)', color: '#000' }}>
                              BINGO!
                            </span>
                          )}
                          {/* Progress bar */}
                          <div className="flex-1 mx-4">
                            <div className="w-full rounded-full h-4" style={{ backgroundColor: 'var(--border-color)' }}>
                              <div
                                className="h-4 rounded-full transition-all duration-500"
                                style={{
                                  width: `${progress}%`,
                                  backgroundColor: isCompleted
                                    ? (isBingoSession ? 'var(--gold-color, #fbbf24)' : 'var(--success-color)')
                                    : 'var(--primary-color)'
                                }}
                              />
                            </div>
                          </div>
                          {/* Stats */}
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <span className="text-xl tabular-nums" style={{ color: 'var(--text-secondary-color)' }}>
                              {isBingoSession ? `${cellsMarked}/${totalCells}` : `${answeredCount}/${totalQ}`}
                            </span>
                            {isBingoSession && linesCompleted > 0 && (
                              <span className="text-xl font-medium" style={{ color: 'var(--success-color)' }}>
                                {linesCompleted} line{linesCompleted !== 1 ? 's' : ''}
                              </span>
                            )}
                            <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--primary-color)', minWidth: 100, textAlign: 'right' }}>
                              {score} pts
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {participants.length === 0 && (
                      <div className="flex items-center justify-center py-16">
                        <p className="text-2xl" style={{ color: 'var(--text-secondary-color)' }}>No participants yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom stats strip */}
                <div
                  className="flex items-center justify-around mt-4 py-4 rounded-xl"
                  style={{ backgroundColor: 'var(--surface-color)' }}
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold" style={{ color: 'var(--primary-color)' }}>{sessionStats.totalParticipants}</div>
                    <div className="text-base" style={{ color: 'var(--text-secondary-color)' }}>Playing</div>
                  </div>
                  {isBingoSession ? (
                    <div className="text-center">
                      <div className="text-3xl font-bold" style={{ color: 'var(--gold-color, #fbbf24)' }}>
                        {participants.filter(p => p.gameState?.gameWon).length}
                      </div>
                      <div className="text-base" style={{ color: 'var(--text-secondary-color)' }}>BINGOs</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-3xl font-bold" style={{ color: 'var(--success-color)' }}>
                        {sessionStats.completedCount}/{sessionStats.totalParticipants}
                      </div>
                      <div className="text-base" style={{ color: 'var(--text-secondary-color)' }}>Completed</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-3xl font-bold" style={{ color: 'var(--info-color, #2563eb)' }}>{sessionStats.averageScore}</div>
                    <div className="text-base" style={{ color: 'var(--text-secondary-color)' }}>Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold" style={{ color: 'var(--accent-color, #9333ea)' }}>{sessionStats.completionRate}%</div>
                    <div className="text-base" style={{ color: 'var(--text-secondary-color)' }}>Complete</div>
                  </div>
                </div>
              </div>
            )}
        </PresenterCanvas>
      </div>

      {/* QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-lg p-8 max-w-md mx-4" style={{ backgroundColor: 'var(--card-background)' }}>
            <div className="text-center">
              <h3 className="text-xl font-bold mb-4">Join Session</h3>
              <div className="p-4 rounded-lg mb-4 bg-white">
                <QRCode
                  value={sessionUrl}
                  size={240}
                  level="M"
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              </div>
              <p className="text-2xl font-mono font-bold text-primary mb-2">{session.code}</p>
              <p className="text-xs text-text-secondary mb-4 break-all">{sessionUrl}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowFullscreenQR(true)}
                  className="btn-secondary"
                >
                  Fullscreen for Projector
                </button>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen QR Code for Large Venues */}
      {showFullscreenQR && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[100] cursor-pointer"
          style={{ backgroundColor: '#0f172a' }}
          onClick={() => setShowFullscreenQR(false)}
        >
          <div className="text-center">
            <div className="mb-8">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">{isBingoSession ? 'Join the Bingo!' : 'Join the Quiz!'}</h1>
              <p className="text-xl md:text-2xl text-gray-400">Scan the QR code or enter the code below</p>
            </div>

            <div className="p-8 rounded-2xl mb-8 bg-white inline-block shadow-2xl">
              <QRCode
                value={sessionUrl}
                size={400}
                level="H"
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              />
            </div>

            <div className="mb-8">
              <p className="text-2xl text-gray-400 mb-2">Session Code</p>
              <p className="text-6xl md:text-8xl font-mono font-bold text-white tracking-widest">
                {session.code}
              </p>
            </div>

            <div className="mb-8">
              <p className="text-lg text-gray-500 mb-1">Go to</p>
              <p className="text-2xl md:text-3xl text-blue-400 font-mono">
                {window.location.origin}/join
              </p>
            </div>

            <p className="text-gray-600 text-lg">
              Click anywhere to close
            </p>
          </div>
        </div>
      )}
      {/* Debug Panel - only in debug mode */}
      {isDebugMode && (
        <div
          className="fixed bottom-4 left-4 z-[200] p-4 rounded-xl shadow-lg space-y-2 text-sm"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            color: '#e2e8f0',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: '220px',
          }}
        >
          <div className="font-bold text-xs uppercase tracking-wider text-amber-400 mb-2">
            Debug Panel
          </div>
          <div className="text-xs" style={{ color: '#94a3b8' }}>
            Phase: <span className="font-mono text-white">{revealPhase}</span>
          </div>
          <div className="text-xs" style={{ color: '#94a3b8' }}>
            Participants: <span className="font-mono text-white">{participants.length}</span>
          </div>
          <div className="text-xs" style={{ color: '#94a3b8' }}>
            Awards: <span className="font-mono text-white">{awardResults.awards.length}</span>
          </div>
          <button
            onClick={() => {
              setRevealPhase('splash')
              setDebugRevealKey(k => k + 1)
            }}
            className="w-full px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: '#3b82f6', color: 'white' }}
          >
            Replay Reveal
          </button>
          <button
            onClick={() => {
              const counts = [3, 5, 8, 10, 15]
              const current = participants.length
              const nextIdx = (counts.indexOf(current) + 1) % counts.length
              const { session: s, quiz: q, participants: p } = generateDebugParticipants(counts[nextIdx])
              setSession(s)
              setQuiz(q)
              setParticipants(p)

              const totalScores = p.reduce((sum, pp) => sum + (pp.gameState?.score || 0), 0)
              const completed = p.filter(pp => pp.completed)
              const allAnswers = p.flatMap(pp => pp.gameState?.answers || [])
              const avgTime = allAnswers.length > 0
                ? allAnswers.reduce((sum, a) => sum + a.timeSpent, 0) / allAnswers.length : 0
              setSessionStats({
                totalParticipants: p.length,
                averageScore: Math.round(totalScores / p.length),
                completionRate: Math.round((completed.length / p.length) * 100),
                averageTime: Math.round(avgTime),
                completedCount: completed.length,
              })
              setRevealPhase('splash')
              setDebugRevealKey(k => k + 1)
            }}
            className="w-full px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: '#6366f1', color: 'white' }}
          >
            Cycle Count ({participants.length} → next)
          </button>
        </div>
      )}
    </div>
    </>
  )
}
