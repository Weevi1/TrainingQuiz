import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import {
  Play, Pause, Square, Users, Clock, Download,
  QrCode, ArrowLeft,
  Zap, Trophy, Target, X, Medal, Star, Award
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { FirestoreService, type GameSession, type Quiz, type Participant } from '../lib/firestore'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { soundSystem } from '../lib/soundSystem'
import { calculateSessionAwards, calculateBingoAwards, type Award, type AwardResults } from '../lib/awardCalculator'
import { generateSessionPDF } from '../lib/pdfExport'
import { downloadAttendanceCertificate } from '../lib/attendanceCertificate'

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
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user, currentOrganization, hasPermission } = useAuth()

  const [session, setSession] = useState<GameSession | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalParticipants: 0,
    averageScore: 0,
    completionRate: 0,
    averageTime: 0,
    completedCount: 0
  })

  const [timeRemaining, setTimeRemaining] = useState(30)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const timerStartedAtRef = useRef<number>(0)       // Anchor: Date.now() when timer started
  const sessionTimeLimitRef = useRef<number>(300)    // Total session time in seconds
  const [loading, setLoading] = useState(true)
  const [showQRCode, setShowQRCode] = useState(false)
  const [showFullscreenQR, setShowFullscreenQR] = useState(false)
  const [participantCountAnimating, setParticipantCountAnimating] = useState(false)
  const [qrSize, setQrSize] = useState(180)
  const previousParticipantCount = useRef(0)

  // Detect if this is a bingo session
  const isBingoSession = session?.gameType === 'bingo'

  // Calculate awards when session is completed
  const awardResults = useMemo<AwardResults>(() => {
    if (session?.status !== 'completed') {
      return { awards: [], topPerformers: [] }
    }
    if (isBingoSession) {
      return calculateBingoAwards(participants)
    }
    if (!quiz) {
      return { awards: [], topPerformers: [] }
    }
    return calculateSessionAwards(participants, quiz.questions.length)
  }, [session?.status, participants, quiz, isBingoSession])

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

  // Check permissions
  useEffect(() => {
    if (!hasPermission('create_sessions')) {
      navigate('/dashboard')
      return
    }
  }, [hasPermission, navigate])

  // Load session data
  useEffect(() => {
    if (sessionId) {
      loadSession()
    }
  }, [sessionId])

  // Real-time participants subscription
  useEffect(() => {
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
      (p.gameState?.answers?.length || 0) >= (quiz?.questions.length || 0)
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
    const totalScores = participantsWithGameState.reduce((sum, p) => sum + (p.gameState?.score || 0), 0)
    const averageScore = participantsWithGameState.length > 0 ? totalScores / participantsWithGameState.length : 0

    // Completion detection differs by game type
    const completedParticipants = participants.filter(p => {
      if (p.completed || p.gameState?.completed) return true
      if (isBingoSession) {
        return p.gameState?.gameWon || p.gameState?.fullCardAchieved
      }
      return (p.gameState?.answers?.length || 0) >= (quiz?.questions.length || 0)
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

  // Export PDF report
  const handleExportPDF = async () => {
    if (!session || !quiz) return

    try {
      soundSystem.play('click')
      await generateSessionPDF(
        session,
        quiz,
        participants,
        awardResults,
        currentOrganization?.name || 'Trained Platform'
      )
      soundSystem.play('celebration')
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF report. Please try again.')
    }
  }

  // Bulk download attendance certificates for all participants
  const handleBulkAttendanceCertificates = async () => {
    if (!session) return
    soundSystem.play('click')
    for (const participant of participants) {
      await downloadAttendanceCertificate({
        participantName: participant.name,
        sessionTitle: session.title,
        completionDate: new Date(),
        organizationName: currentOrganization?.name,
        organizationLogo: currentOrganization?.branding?.logo,
        sessionCode: session.code,
        primaryColor: currentOrganization?.branding?.primaryColor,
        secondaryColor: currentOrganization?.branding?.secondaryColor
      })
      // Brief delay between downloads to prevent browser blocking
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    soundSystem.play('celebration')
  }

  // Download single participant attendance certificate
  const handleSingleAttendanceCertificate = async (participantName: string) => {
    if (!session) return
    soundSystem.play('click')
    await downloadAttendanceCertificate({
      participantName,
      sessionTitle: session.title,
      completionDate: new Date(),
      organizationName: currentOrganization?.name,
      organizationLogo: currentOrganization?.branding?.logo,
      sessionCode: session.code,
      primaryColor: currentOrganization?.branding?.primaryColor,
      secondaryColor: currentOrganization?.branding?.secondaryColor
    })
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* WAITING STATE: Show lobby focused on participants */}
            {session.status === 'waiting' && (
              <>
                {/* Participants Panel - Main focus during waiting */}
                <div className="card">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--primary-color)' }}>
                        <Users size={20} style={{ color: 'var(--text-on-primary-color, white)' }} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Participants</h2>
                        <p className="text-sm text-text-secondary">Waiting to join</p>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 ${
                        participantCountAnimating ? 'scale-125 ring-2 ring-offset-2' : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--info-bg-color, #dbeafe)',
                        color: 'var(--info-color, #1e40af)',
                        ringColor: 'var(--info-color, #1e40af)'
                      }}
                    >
                      {participants.length} joined
                    </div>
                  </div>

                  {participants.length === 0 ? (
                    <div className="text-center py-12">
                      <div
                        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                        style={{ backgroundColor: 'var(--surface-color)' }}
                      >
                        <Users size={32} className="text-text-secondary" />
                      </div>
                      <p className="text-lg font-medium mb-2">Waiting for participants</p>
                      <p className="text-text-secondary">Share the QR code or session code to let participants join</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {participants.map((participant, index) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between p-3 rounded-lg transition-all duration-300 group"
                          style={{
                            backgroundColor: 'var(--surface-color)',
                            animation: 'fadeIn 0.3s ease-out'
                          }}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="relative flex-shrink-0">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                style={{ backgroundColor: 'var(--primary-light-color)', color: 'var(--text-on-primary-color, white)' }}
                              >
                                {(participant as any).avatar || '😀'}
                              </div>
                              {/* Status indicator dot */}
                              <div
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                                style={{
                                  backgroundColor: participant.isReady ? 'var(--success-color, #22c55e)' : 'var(--warning-color, #eab308)',
                                  borderColor: 'var(--surface-color)'
                                }}
                                title={participant.isReady ? 'Ready' : 'Joining...'}
                              />
                            </div>
                            <span className="font-medium truncate">{participant.name}</span>
                          </div>
                          {/* Kick button - shows on hover */}
                          <button
                            onClick={() => kickParticipant(participant.id, participant.name)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-red-100"
                            style={{ color: 'var(--error-color, #ef4444)' }}
                            title={`Remove ${participant.name}`}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Game Info */}
                <div className="card">
                  <h3 className="font-semibold mb-4">{isBingoSession ? 'Bingo Details' : 'Quiz Details'}</h3>
                  {isBingoSession ? (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary">5x5</div>
                        <div className="text-sm text-text-secondary">Card Size</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">Line</div>
                        <div className="text-sm text-text-secondary">Win Condition</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">{formatTime(session.settings?.timeLimit || 900)}</div>
                        <div className="text-sm text-text-secondary">Time Limit</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary">{quiz.questions.length}</div>
                        <div className="text-sm text-text-secondary">Questions</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">{quiz.timeLimit}s</div>
                        <div className="text-sm text-text-secondary">Per Question</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-primary">{formatTime(quiz.timeLimit * quiz.questions.length)}</div>
                        <div className="text-sm text-text-secondary">Total Time</div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* COMPLETED STATE: Show results and awards */}
            {session.status === 'completed' && (
              <>
                {/* Action Bar */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-color)' }}>
                    Session Complete
                  </h2>
                  <div className="flex items-center space-x-2">
                    {currentOrganization?.settings?.enableAttendanceCertificates && (
                      <button
                        onClick={handleBulkAttendanceCertificates}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <Award size={16} />
                        <span>All Certificates</span>
                      </button>
                    )}
                    <button
                      onClick={handleExportPDF}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Download size={16} />
                      <span>Export PDF Report</span>
                    </button>
                  </div>
                </div>

                {/* Top Performers Podium */}
                {awardResults.topPerformers.length > 0 && (
                  <div className="card mb-6">
                    <div className="flex items-center space-x-2 mb-6">
                      <Trophy size={24} style={{ color: 'var(--gold-color, #fbbf24)' }} />
                      <h2 className="text-xl font-bold">Top Performers</h2>
                    </div>
                    <div className="flex justify-center items-end space-x-4">
                      {/* 2nd place */}
                      {awardResults.topPerformers[1] && (
                        <div className="text-center">
                          <div
                            className="w-20 h-24 rounded-t-lg flex flex-col items-center justify-end pb-2"
                            style={{ backgroundColor: 'var(--silver-color, #9ca3af)' }}
                          >
                            <span className="text-2xl font-bold text-white">2</span>
                          </div>
                          <p className="font-medium mt-2 text-sm truncate max-w-20">{awardResults.topPerformers[1].participantName}</p>
                          <p className="text-xs text-text-secondary">{scoreToPercentage(awardResults.topPerformers[1].value)}</p>
                        </div>
                      )}
                      {/* 1st place */}
                      {awardResults.topPerformers[0] && (
                        <div className="text-center">
                          <div
                            className="w-24 h-32 rounded-t-lg flex flex-col items-center justify-end pb-2"
                            style={{ backgroundColor: 'var(--gold-color, #fbbf24)' }}
                          >
                            <Trophy size={28} className="text-white mb-1" />
                            <span className="text-3xl font-bold text-white">1</span>
                          </div>
                          <p className="font-bold mt-2 truncate max-w-24">{awardResults.topPerformers[0].participantName}</p>
                          <p className="text-sm text-primary font-semibold">{scoreToPercentage(awardResults.topPerformers[0].value)}</p>
                        </div>
                      )}
                      {/* 3rd place */}
                      {awardResults.topPerformers[2] && (
                        <div className="text-center">
                          <div
                            className="w-20 h-20 rounded-t-lg flex flex-col items-center justify-end pb-2"
                            style={{ backgroundColor: 'var(--bronze-color, #d97706)' }}
                          >
                            <span className="text-2xl font-bold text-white">3</span>
                          </div>
                          <p className="font-medium mt-2 text-sm truncate max-w-20">{awardResults.topPerformers[2].participantName}</p>
                          <p className="text-xs text-text-secondary">{scoreToPercentage(awardResults.topPerformers[2].value)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Awards Section */}
                {awardResults.awards.length > 0 && (
                  <div className="card mb-6">
                    <div className="flex items-center space-x-2 mb-6">
                      <Medal size={24} style={{ color: 'var(--celebration-color, #8b5cf6)' }} />
                      <h2 className="text-xl font-bold">Session Awards</h2>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {awardResults.awards.map((award) => (
                        <div
                          key={award.id}
                          className="p-4 rounded-lg border-2"
                          style={{
                            borderColor: award.color,
                            backgroundColor: 'var(--surface-color)'
                          }}
                        >
                          <div className="flex items-center space-x-3 mb-3">
                            <div
                              className="p-2 rounded-full"
                              style={{ backgroundColor: award.color, color: 'white' }}
                            >
                              {getAwardIcon(award.icon, 20)}
                            </div>
                            <div>
                              <h3 className="font-bold">{award.name}</h3>
                              <p className="text-xs text-text-secondary">{award.description}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {award.recipients.map((recipient, idx) => (
                              <div
                                key={`${recipient.participantId}-${idx}`}
                                className="flex justify-between items-center text-sm p-2 rounded"
                                style={{ backgroundColor: 'var(--background-color)' }}
                              >
                                <span className="font-medium">{recipient.participantName}</span>
                                <span className="text-text-secondary">{recipient.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Leaderboard */}
                <div className="card mb-6">
                  <div className="flex items-center space-x-2 mb-6">
                    <Users size={24} style={{ color: 'var(--primary-color)' }} />
                    <h2 className="text-xl font-bold">Final Leaderboard</h2>
                  </div>
                  <div className="space-y-2">
                    {participants
                      .slice()
                      .sort((a, b) => {
                        const scoreA = a.gameState?.score || a.finalScore || 0
                        const scoreB = b.gameState?.score || b.finalScore || 0
                        if (scoreB !== scoreA) return scoreB - scoreA
                        const answersA = a.gameState?.answers || []
                        const answersB = b.gameState?.answers || []
                        const avgTimeA = answersA.length > 0 ? answersA.reduce((s: number, ans: any) => s + (ans.timeSpent || 0), 0) / answersA.length : 999
                        const avgTimeB = answersB.length > 0 ? answersB.reduce((s: number, ans: any) => s + (ans.timeSpent || 0), 0) / answersB.length : 999
                        return avgTimeA - avgTimeB
                      })
                      .map((participant, index) => {
                        const rank = index + 1
                        const answeredCount = participant.gameState?.answers?.length || 0
                        const correctCount = participant.gameState?.answers?.filter((a: any) => a.isCorrect).length || 0
                        const totalQ = quiz?.questions.length || 1
                        const pct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0
                        const avgTime = answeredCount > 0
                          ? Math.round((participant.gameState?.answers?.reduce((sum: number, a: any) => sum + (a.timeSpent || 0), 0) || 0) / answeredCount)
                          : 0
                        let bestStreak = 0
                        let curStreak = 0
                        ;(participant.gameState?.answers || []).forEach((a: any) => {
                          if (a.isCorrect) { curStreak++; bestStreak = Math.max(bestStreak, curStreak) }
                          else { curStreak = 0 }
                        })
                        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''
                        const isCompleted = participant.completed || participant.gameState?.completed ||
                          answeredCount >= totalQ

                        return (
                          <div
                            key={participant.id}
                            className="flex items-center justify-between p-3 rounded-lg"
                            style={{
                              backgroundColor: rank === 1 ? 'rgba(251, 191, 36, 0.15)'
                                : rank === 2 ? 'rgba(156, 163, 175, 0.15)'
                                : rank === 3 ? 'rgba(217, 119, 6, 0.15)'
                                : 'var(--surface-color)'
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 text-center font-bold text-lg">
                                {medal || rank}
                              </div>
                              <span className="text-lg">{(participant as any).avatar || '😀'}</span>
                              <div>
                                <span className="font-medium">{participant.name}</span>
                                {isCompleted && (
                                  <span
                                    className="ml-2 text-xs px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: 'var(--success-light-color, #dcfce7)', color: 'var(--success-color, #166534)' }}
                                  >
                                    Done
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="text-center">
                                <div className="font-bold text-lg" style={{ color: 'var(--primary-color)' }}>{pct}%</div>
                                <div className="text-xs text-text-secondary">{correctCount}/{totalQ}</div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium">{avgTime}s</div>
                                <div className="text-xs text-text-secondary">Avg</div>
                              </div>
                              {bestStreak >= 2 && (
                                <div className="text-center">
                                  <div className="font-medium">🔥 {bestStreak}</div>
                                  <div className="text-xs text-text-secondary">Streak</div>
                                </div>
                              )}
                              {currentOrganization?.settings?.enableAttendanceCertificates && (
                                <button
                                  onClick={() => handleSingleAttendanceCertificate(participant.name)}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-white/20"
                                  style={{ color: 'var(--primary-color)' }}
                                  title={`Download attendance certificate for ${participant.name}`}
                                >
                                  <Download size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    {participants.length === 0 && (
                      <p className="text-center text-text-secondary py-4">No participants</p>
                    )}
                  </div>
                </div>

                {/* Final Statistics */}
                <div className="card">
                  <h3 className="font-semibold mb-4">Final Results Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-color)' }}>
                      <div className="text-3xl font-bold text-primary">{sessionStats.totalParticipants}</div>
                      <div className="text-sm text-text-secondary">Total Participants</div>
                    </div>
                    <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-color)' }}>
                      <div className="text-3xl font-bold" style={{ color: 'var(--success-color)' }}>{scoreToPercentage(sessionStats.averageScore)}</div>
                      <div className="text-sm text-text-secondary">Average Score</div>
                    </div>
                    {isBingoSession ? (
                      <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-color)' }}>
                        <div className="text-3xl font-bold" style={{ color: 'var(--gold-color, #fbbf24)' }}>
                          {participants.filter(p => p.gameState?.gameWon).length}
                        </div>
                        <div className="text-sm text-text-secondary">Total BINGOs</div>
                      </div>
                    ) : (
                      <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-color)' }}>
                        <div className="text-3xl font-bold" style={{ color: 'var(--info-color, #2563eb)' }}>{sessionStats.completionRate}%</div>
                        <div className="text-sm text-text-secondary">Completion Rate</div>
                      </div>
                    )}
                    <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-color)' }}>
                      <div className="text-3xl font-bold" style={{ color: 'var(--accent-color, #9333ea)' }}>
                        {isBingoSession ? formatTime(sessionStats.averageTime) : `${sessionStats.averageTime}s`}
                      </div>
                      <div className="text-sm text-text-secondary">{isBingoSession ? 'Avg Time Spent' : 'Avg Response Time'}</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ACTIVE STATE: Show questions (quiz) or progress (bingo) */}
            {session.status === 'active' && (
              <>
                {isBingoSession ? (
                  /* BINGO ACTIVE STATE: Show participant progress */
                  <>
                    <div className="card">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">Bingo Session Active</h2>
                        <div
                          className="px-3 py-1 rounded text-sm font-medium"
                          style={{
                            backgroundColor: 'var(--success-light-color, #dcfce7)',
                            color: 'var(--success-color, #166534)'
                          }}
                        >
                          ACTIVE
                        </div>
                      </div>

                      {/* Timer */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-text-secondary">Time Remaining</span>
                          <button
                            onClick={resetTimer}
                            className="text-sm text-primary hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div
                            className="text-4xl font-bold"
                            style={{ color: timeRemaining <= 60 ? 'var(--error-color)' : 'var(--primary-color)' }}
                          >
                            {formatTime(timeRemaining)}
                          </div>
                          <div className="flex-1">
                            <div
                              className="w-full rounded-full h-3"
                              style={{ backgroundColor: 'var(--border-color)' }}
                            >
                              <div
                                className="h-3 rounded-full transition-all duration-1000"
                                style={{
                                  width: `${(timeRemaining / (session.settings?.timeLimit || 900)) * 100}%`,
                                  backgroundColor: timeRemaining <= 60 ? 'var(--error-color)' : 'var(--primary-color)'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bingo Participant Progress */}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-4">Participant Progress</h3>
                        <div className="space-y-3">
                          {participants.map((participant) => {
                            const gs = participant.gameState
                            const cellsMarked = gs?.cellsMarked || 0
                            const totalCells = gs?.totalCells || 25
                            const progress = totalCells > 0 ? (cellsMarked / totalCells) * 100 : 0
                            const hasWon = gs?.gameWon || false
                            const linesCompleted = gs?.linesCompleted || 0

                            return (
                              <div
                                key={participant.id}
                                className="p-3 rounded-lg"
                                style={{
                                  backgroundColor: hasWon
                                    ? 'var(--success-light-color, #dcfce7)'
                                    : 'var(--surface-color)'
                                }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-lg">{(participant as any).avatar || '😀'}</span>
                                    <span className="font-medium">{participant.name}</span>
                                    {hasWon && (
                                      <span
                                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                                        style={{
                                          backgroundColor: 'var(--gold-color, #fbbf24)',
                                          color: '#000'
                                        }}
                                      >
                                        BINGO!
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-3 text-sm text-text-secondary">
                                    <span>{cellsMarked}/{totalCells} cells</span>
                                    {linesCompleted > 0 && (
                                      <span className="font-medium" style={{ color: 'var(--success-color)' }}>
                                        {linesCompleted} line{linesCompleted !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    <span className="font-semibold" style={{ color: 'var(--primary-color)' }}>
                                      {gs?.score || 0} pts
                                    </span>
                                  </div>
                                </div>
                                <div
                                  className="w-full rounded-full h-2"
                                  style={{ backgroundColor: 'var(--border-color)' }}
                                >
                                  <div
                                    className="h-2 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${progress}%`,
                                      backgroundColor: hasWon
                                        ? 'var(--gold-color, #fbbf24)'
                                        : 'var(--primary-color)'
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                          {participants.length === 0 && (
                            <p className="text-center text-text-secondary py-4">No participants yet</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Live Statistics */}
                    <div className="card">
                      <h3 className="font-semibold mb-4">Live Statistics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{sessionStats.totalParticipants}</div>
                          <div className="text-sm text-text-secondary">Participants</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold" style={{ color: 'var(--gold-color, #fbbf24)' }}>
                            {participants.filter(p => p.gameState?.gameWon).length}
                          </div>
                          <div className="text-sm text-text-secondary">BINGOs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>{sessionStats.averageScore}</div>
                          <div className="text-sm text-text-secondary">Avg Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold" style={{ color: 'var(--info-color, #2563eb)' }}>{sessionStats.completionRate}%</div>
                          <div className="text-sm text-text-secondary">Completion</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* QUIZ ACTIVE STATE: Show participant progress (presenter view) */
                  <>
                    <div className="card">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">Quiz Session Active</h2>
                        <div
                          className="px-3 py-1 rounded text-sm font-medium animate-pulse"
                          style={{
                            backgroundColor: 'var(--success-light-color, #dcfce7)',
                            color: 'var(--success-color, #166534)'
                          }}
                        >
                          LIVE
                        </div>
                      </div>

                      {/* Session Timer */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-text-secondary">Session Time Remaining</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div
                            className={`text-4xl font-bold font-mono ${timeRemaining <= 60 ? 'animate-pulse' : ''}`}
                            style={{
                              color: timeRemaining <= 60 ? 'var(--error-color)' :
                                timeRemaining <= 120 ? 'var(--warning-color, #eab308)' :
                                'var(--primary-color)'
                            }}
                          >
                            {formatTime(timeRemaining)}
                          </div>
                          <div className="flex-1">
                            <div
                              className="w-full rounded-full h-3"
                              style={{ backgroundColor: 'var(--border-color)' }}
                            >
                              <div
                                className="h-3 rounded-full transition-all duration-1000"
                                style={{
                                  width: `${(timeRemaining / (quiz.timeLimit * quiz.questions.length)) * 100}%`,
                                  backgroundColor: timeRemaining <= 60 ? 'var(--error-color)' :
                                    timeRemaining <= 120 ? 'var(--warning-color, #eab308)' :
                                    'var(--primary-color)'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quiz Info Summary */}
                      <div
                        className="grid grid-cols-3 gap-4 text-center mb-6 p-4 rounded-lg"
                        style={{ backgroundColor: 'var(--background-color)' }}
                      >
                        <div>
                          <div className="text-2xl font-bold text-primary">{quiz.questions.length}</div>
                          <div className="text-sm text-text-secondary">Questions</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">{quiz.timeLimit}s</div>
                          <div className="text-sm text-text-secondary">Per Question</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>
                            {sessionStats.completedCount}/{sessionStats.totalParticipants}
                          </div>
                          <div className="text-sm text-text-secondary">Completed</div>
                        </div>
                      </div>

                      {/* Participant Progress */}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-4">Participant Progress</h3>
                        <div className="space-y-3">
                          {participants
                            .slice()
                            .sort((a, b) => (b.gameState?.score || 0) - (a.gameState?.score || 0))
                            .map((participant) => {
                              const answeredCount = participant.gameState?.answers?.length || 0
                              const totalQ = quiz.questions.length
                              const progress = totalQ > 0 ? (answeredCount / totalQ) * 100 : 0
                              const isCompleted = participant.completed || participant.gameState?.completed ||
                                answeredCount >= totalQ
                              const score = participant.gameState?.score || 0

                              return (
                                <div
                                  key={participant.id}
                                  className="p-3 rounded-lg"
                                  style={{
                                    backgroundColor: isCompleted
                                      ? 'var(--success-light-color, #dcfce7)'
                                      : 'var(--surface-color)'
                                  }}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-lg">{(participant as any).avatar || '😀'}</span>
                                      <span className="font-medium">{participant.name}</span>
                                      {isCompleted && (
                                        <span
                                          className="px-2 py-0.5 rounded-full text-xs font-bold"
                                          style={{
                                            backgroundColor: 'var(--success-color)',
                                            color: 'white'
                                          }}
                                        >
                                          DONE
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-3 text-sm text-text-secondary">
                                      <span>{answeredCount}/{totalQ} answered</span>
                                      <span className="font-semibold" style={{ color: 'var(--primary-color)' }}>
                                        {score} pts
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className="w-full rounded-full h-2"
                                    style={{ backgroundColor: 'var(--border-color)' }}
                                  >
                                    <div
                                      className="h-2 rounded-full transition-all duration-500"
                                      style={{
                                        width: `${progress}%`,
                                        backgroundColor: isCompleted
                                          ? 'var(--success-color)'
                                          : 'var(--primary-color)'
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          {participants.length === 0 && (
                            <p className="text-center text-text-secondary py-4">No participants yet</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Live Statistics */}
                    <div className="card">
                      <h3 className="font-semibold mb-4">Live Statistics</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{sessionStats.totalParticipants}</div>
                          <div className="text-sm text-text-secondary">Participants</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold" style={{ color: 'var(--success-color)' }}>{sessionStats.averageScore}</div>
                          <div className="text-sm text-text-secondary">Avg Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold" style={{ color: 'var(--info-color, #2563eb)' }}>{sessionStats.completionRate}%</div>
                          <div className="text-sm text-text-secondary">Completion</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold" style={{ color: 'var(--accent-color, #9333ea)' }}>{sessionStats.averageTime}s</div>
                          <div className="text-sm text-text-secondary">Avg Time</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* QR Code Card - Always visible, prominent during waiting */}
            <div className="card">
              <div className="flex items-center space-x-2 mb-4">
                <Target size={20} className="text-primary" />
                <h3 className="font-semibold">Join Session</h3>
              </div>
              <div className="text-center">
                <div className="p-4 rounded-lg bg-white inline-block mb-4">
                  <QRCode
                    value={sessionUrl}
                    size={qrSize}
                    level="M"
                  />
                </div>
                <div
                  className="rounded-lg p-3 mb-3"
                  style={{ backgroundColor: 'var(--surface-color)' }}
                >
                  <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Session Code</p>
                  <p className="text-2xl font-mono font-bold text-primary">{session.code}</p>
                </div>
                <p className="text-xs text-text-secondary break-all">{sessionUrl}</p>
              </div>
            </div>

            {/* Participants List - Compact view in sidebar */}
            {session.status !== 'waiting' && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center space-x-2">
                    <Users size={20} />
                    <span>Participants ({participants.length})</span>
                  </h3>
                  {sessionStats.completedCount > 0 && (
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ backgroundColor: 'var(--success-light-color)', color: 'var(--success-color)' }}
                    >
                      {sessionStats.completedCount} done
                    </span>
                  )}
                </div>

                {participants.length === 0 ? (
                  <div className="text-center py-4 text-text-secondary">
                    <p>No participants yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {participants.map((participant) => {
                      const isCompleted = participant.completed || participant.gameState?.completed ||
                        (isBingoSession && (participant.gameState?.gameWon || participant.gameState?.fullCardAchieved))
                      return (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between p-2 rounded-lg group"
                          style={{
                            backgroundColor: isCompleted
                              ? 'var(--success-light-color, #dcfce7)'
                              : 'var(--surface-color)'
                          }}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-lg flex-shrink-0">{(participant as any).avatar || '😀'}</span>
                            <span className="font-medium text-sm truncate">{participant.name}</span>
                            {isBingoSession && participant.gameState?.gameWon && (
                              <span
                                className="px-1 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
                                style={{ backgroundColor: 'var(--gold-color, #fbbf24)', color: '#000' }}
                              >
                                BINGO
                              </span>
                            )}
                            {!isBingoSession && isCompleted && (
                              <Trophy size={14} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {isBingoSession ? (
                              <span className="text-xs text-text-secondary">
                                {participant.gameState?.cellsMarked || 0}/{participant.gameState?.totalCells || 25}
                              </span>
                            ) : (
                              <span className="text-xs text-text-secondary">
                                {participant.gameState?.score || participant.finalScore || 0} pts
                              </span>
                            )}
                            {/* Kick button */}
                            <button
                              onClick={() => kickParticipant(participant.id, participant.name)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-red-100"
                              style={{ color: 'var(--error-color, #ef4444)' }}
                              title={`Remove ${participant.name}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Timer Card - During waiting */}
            {session.status === 'waiting' && (
              <div className="card">
                <div className="flex items-center space-x-2 mb-4">
                  <Clock size={20} className="text-primary" />
                  <h3 className="font-semibold">{isBingoSession ? 'Session Duration' : 'Quiz Duration'}</h3>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold text-primary mb-2">
                    {isBingoSession
                      ? formatTime(session.settings?.timeLimit || 900)
                      : formatTime(quiz.timeLimit * quiz.questions.length)
                    }
                  </div>
                  <p className="text-sm text-text-secondary">
                    {isBingoSession ? 'Time limit' : 'Total estimated time'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
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
    </div>
  )
}
